// Admin endpoints for categories and subcategories.
//
// GET    /api/v1/admin/categories              — list all (active + inactive)
// POST   /api/v1/admin/categories              — create category
// PUT    /api/v1/admin/categories/:id          — update category
// DELETE /api/v1/admin/categories/:id          — deactivate (soft archive) category
//
// POST   /api/v1/admin/subcategories           — create subcategory
// PUT    /api/v1/admin/subcategories/:id       — update subcategory
// DELETE /api/v1/admin/subcategories/:id       — deactivate (soft archive) subcategory
//
// NOTE: Delete is a safe deactivate (is_active = false), not a hard delete.
// Hard deletes are blocked at the DB level (place_categories.category_id ON DELETE RESTRICT).
//
// NOTE: No authentication middleware is applied here. Before opening this API
// to the internet, add a preHandler that verifies admin_users membership.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ValidationError } from '../../../shared/errors/AppError'
import { authenticateDashboardUser } from '../../../shared/auth/dashboardAuth'
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
} from './admin-categories.dto'
import {
  createCategory,
  updateCategory,
  deactivateCategory,
  createSubcategory,
  updateSubcategory,
  deactivateSubcategory,
} from './admin-categories.query'
import { db } from '../../../db/postgres'

const idParamsSchema = z.object({ id: z.string().uuid('id must be a valid UUID') })

export async function adminCategoriesRoutes(app: FastifyInstance) {

  // ── GET /admin/categories ───────────────────────────────────────────────────
  // Returns all categories (active and inactive) with their subcategories.
  // Exposes the full set of admin-editable fields.
  app.get('/admin/categories', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { locale: rawLocale } = z.object({ locale: z.string().default('en') }).parse(request.query)
    const lang = rawLocale.split('-')[0]

    const { rows: cats } = await db.query<{
      id: string; slug: string; name: string; description: string | null
      icon_name: string | null; sort_order: number; is_active: boolean
    }>(
      `
      SELECT c.id, c.slug,
             COALESCE(NULLIF(ct_loc.name,''), NULLIF(ct_en.name,''), c.slug)  AS name,
             COALESCE(ct_loc.description, ct_en.description) AS description,
             c.icon_name,
             c.sort_order,
             c.is_active
      FROM   categories c
      LEFT JOIN category_translations ct_loc
             ON ct_loc.category_id = c.id AND ct_loc.locale = $1
      LEFT JOIN category_translations ct_en
             ON ct_en.category_id = c.id AND ct_en.locale = 'en'
      ORDER  BY c.sort_order ASC, c.slug ASC
      `,
      [lang],
    )

    const { rows: subs } = await db.query<{
      id: string; slug: string; name: string; description: string | null
      category_id: string; sort_order: number; is_active: boolean
    }>(
      `
      SELECT s.id, s.slug, s.category_id,
             COALESCE(NULLIF(st_loc.name,''), NULLIF(st_en.name,''), s.slug) AS name,
             COALESCE(st_loc.description, st_en.description) AS description,
             s.sort_order,
             s.is_active
      FROM   subcategories s
      LEFT JOIN subcategory_translations st_loc
             ON st_loc.subcategory_id = s.id AND st_loc.locale = $1
      LEFT JOIN subcategory_translations st_en
             ON st_en.subcategory_id = s.id AND st_en.locale = 'en'
      ORDER  BY s.sort_order ASC, s.slug ASC
      `,
      [lang],
    )

    const subsByCatId = new Map<string, typeof subs>()
    for (const s of subs) {
      const list = subsByCatId.get(s.category_id) ?? []
      list.push(s)
      subsByCatId.set(s.category_id, list)
    }

    const items = cats.map((c) => ({
      id:          c.id,
      slug:        c.slug,
      name:        c.name,
      description: c.description,
      iconName:    c.icon_name,
      sortOrder:   c.sort_order,
      isActive:    c.is_active,
      subcategories: (subsByCatId.get(c.id) ?? []).map((s) => ({
        id:          s.id,
        slug:        s.slug,
        name:        s.name,
        description: s.description,
        sortOrder:   s.sort_order,
        isActive:    s.is_active,
      })),
    }))

    return reply.send({ items })
  })

  // ── POST /admin/categories ──────────────────────────────────────────────────
  app.post('/admin/categories', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const category = await createCategory(parsed.data)
    return reply.status(201).send(category)
  })

  // ── PUT /admin/categories/:id ───────────────────────────────────────────────
  app.put('/admin/categories/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    const parsed = updateCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const category = await updateCategory(id, parsed.data)
    return reply.send(category)
  })

  // ── DELETE /admin/categories/:id ────────────────────────────────────────────
  // Deactivates (soft-archives) the category. Sets is_active = false.
  // The category remains in the DB so existing place-category links are preserved.
  app.delete('/admin/categories/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    await deactivateCategory(id)
    return reply.status(204).send()
  })

  // ── POST /admin/subcategories ───────────────────────────────────────────────
  app.post('/admin/subcategories', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const parsed = createSubcategorySchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const subcategory = await createSubcategory(parsed.data)
    return reply.status(201).send(subcategory)
  })

  // ── PUT /admin/subcategories/:id ────────────────────────────────────────────
  app.put('/admin/subcategories/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)

    const parsed = updateSubcategorySchema.safeParse(request.body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new ValidationError(`${first.path.join('.')}: ${first.message}`)
    }

    const subcategory = await updateSubcategory(id, parsed.data)
    return reply.send(subcategory)
  })

  // ── DELETE /admin/subcategories/:id ─────────────────────────────────────────
  app.delete('/admin/subcategories/:id', { preHandler: [authenticateDashboardUser] }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params)
    await deactivateSubcategory(id)
    return reply.status(204).send()
  })
}
