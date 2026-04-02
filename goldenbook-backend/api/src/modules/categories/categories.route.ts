import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NotFoundError } from '../../shared/errors/AppError'
import {
  getCategoryBySlug,
  getCategorySubcategories,
  getCategoryPlaces,
  getSubcategoryBySlug,
  getSubcategoryPlaces,
} from './categories.query'
import { toCategoryDetailDTO } from './categories.dto'
import { normalizeLocale } from '../../shared/i18n/locale'

const paramsSchema = z.object({ slug: z.string().min(1) })
const querySchema  = z.object({
  city:   z.string().min(1),
  locale: z.string().min(2).max(5).default('en'),
})

export async function categoriesRoutes(app: FastifyInstance) {
  app.get('/categories/:slug', async (request, reply) => {
    const { slug }         = paramsSchema.parse(request.params)
    const { city, locale: rawLocale } = querySchema.parse(request.query)
    const locale = normalizeLocale(rawLocale)

    // Try category first
    const category = await getCategoryBySlug(slug, locale)
    if (category) {
      const [subcategories, places] = await Promise.all([
        getCategorySubcategories(category.id, locale),
        getCategoryPlaces(category.id, city, locale, 50, slug),
      ])
      return reply.send(toCategoryDetailDTO(category, subcategories, places))
    }

    // Fall back to subcategory (e.g. chip navigation from place detail)
    const subcategory = await getSubcategoryBySlug(slug, locale)
    if (!subcategory) throw new NotFoundError('Category')

    const places = await getSubcategoryPlaces(subcategory.id, city, locale)
    return reply.send(toCategoryDetailDTO(subcategory, [], places))
  })
}
