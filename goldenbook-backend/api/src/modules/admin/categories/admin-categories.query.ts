import { db } from '../../../db/postgres'
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError'
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateSubcategoryInput,
  UpdateSubcategoryInput,
  AdminCategoryResponseDTO,
  AdminSubcategoryResponseDTO,
} from './admin-categories.dto'

function nullify(v: string | undefined): string | null {
  return v === undefined || v === '' ? null : v
}

// ─── Category: create ─────────────────────────────────────────────────────────

export async function createCategory(
  input: CreateCategoryInput,
): Promise<AdminCategoryResponseDTO> {
  const { rows: existing } = await db.query<{ id: string }>(
    `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
    [input.slug],
  )
  if (existing[0]) {
    throw new AppError(409, `Slug "${input.slug}" is already taken`, 'SLUG_CONFLICT')
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: inserted } = await client.query<{
      id: string; slug: string; icon_name: string | null; sort_order: number; is_active: boolean
    }>(
      `
      INSERT INTO categories (slug, icon_name, sort_order, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, slug, icon_name, sort_order, is_active
      `,
      [input.slug, nullify(input.iconName), input.sortOrder],
    )
    const cat = inserted[0]

    await client.query(
      `
      INSERT INTO category_translations (category_id, locale, name, description)
      VALUES ($1, 'en', $2, $3)
      ON CONFLICT (category_id, locale) DO UPDATE SET
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at  = now()
      `,
      [cat.id, input.name, nullify(input.description)],
    )

    await client.query('COMMIT')

    return {
      id:          cat.id,
      slug:        cat.slug,
      name:        input.name,
      description: nullify(input.description),
      iconName:    cat.icon_name,
      sortOrder:   cat.sort_order,
      isActive:    cat.is_active,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Category: update ─────────────────────────────────────────────────────────

export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<AdminCategoryResponseDTO> {
  const { rows: found } = await db.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM categories WHERE id = $1 LIMIT 1`,
    [categoryId],
  )
  if (!found[0]) throw new NotFoundError('Category')
  const existing = found[0]

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Slug uniqueness check if changing
    if (input.slug && input.slug !== existing.slug) {
      const { rows: slugCheck } = await client.query<{ id: string }>(
        `SELECT id FROM categories WHERE slug = $1 LIMIT 1`,
        [input.slug],
      )
      if (slugCheck[0]) {
        throw new AppError(409, `Slug "${input.slug}" is already taken`, 'SLUG_CONFLICT')
      }
    }

    // Dynamic SET for categories table
    const setClauses: string[] = []
    const params: unknown[]    = []
    let   i = 1

    function addField(column: string, value: unknown) {
      setClauses.push(`${column} = $${i++}`)
      params.push(value)
    }

    if (input.slug      !== undefined) addField('slug',       input.slug)
    if (input.iconName  !== undefined) addField('icon_name',  nullify(input.iconName))
    if (input.sortOrder !== undefined) addField('sort_order', input.sortOrder)
    if (input.isActive  !== undefined) addField('is_active',  input.isActive)

    setClauses.push(`updated_at = now()`)

    if (setClauses.length > 1) {
      params.push(categoryId)
      await client.query(
        `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $${i}`,
        params,
      )
    }

    // Upsert translation
    if (input.name !== undefined || input.description !== undefined) {
      const { rows: ct } = await client.query<{ name: string | null; description: string | null }>(
        `SELECT name, description FROM category_translations WHERE category_id = $1 AND locale = 'en' LIMIT 1`,
        [categoryId],
      )
      const current = ct[0] ?? {}

      await client.query(
        `
        INSERT INTO category_translations (category_id, locale, name, description)
        VALUES ($1, 'en', $2, $3)
        ON CONFLICT (category_id, locale) DO UPDATE SET
          name        = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at  = now()
        `,
        [
          categoryId,
          input.name        ?? current.name,
          input.description !== undefined ? nullify(input.description) : current.description,
        ],
      )
    }

    await client.query('COMMIT')

    // Return final state
    const { rows: final } = await db.query<{
      id: string; slug: string; name: string | null; description: string | null
      icon_name: string | null; sort_order: number; is_active: boolean
    }>(
      `
      SELECT c.id, c.slug, ct.name, ct.description, c.icon_name, c.sort_order, c.is_active
      FROM   categories c
      LEFT JOIN category_translations ct ON ct.category_id = c.id AND ct.locale = 'en'
      WHERE  c.id = $1 LIMIT 1
      `,
      [categoryId],
    )
    const f = final[0]

    return {
      id:          f.id,
      slug:        f.slug,
      name:        f.name ?? f.slug,
      description: f.description,
      iconName:    f.icon_name,
      sortOrder:   f.sort_order,
      isActive:    f.is_active,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Category: deactivate (safe archive) ─────────────────────────────────────
//
// Hard delete is blocked by place_categories.category_id ON DELETE RESTRICT.
// Any category still linked to a place cannot be hard-deleted without first
// re-assigning those places. Deactivating is always safe: the category stays
// in the DB for existing place links but disappears from app navigation/dropdowns.

export async function deactivateCategory(categoryId: string): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE categories SET is_active = false, updated_at = now() WHERE id = $1`,
    [categoryId],
  )
  if (!rowCount) throw new NotFoundError('Category')
}

// ─── Subcategory: create ──────────────────────────────────────────────────────

export async function createSubcategory(
  input: CreateSubcategoryInput,
): Promise<AdminSubcategoryResponseDTO> {
  // Verify parent category exists and is active
  const { rows: cats } = await db.query<{ id: string }>(
    `SELECT id FROM categories WHERE id = $1 AND is_active = true LIMIT 1`,
    [input.categoryId],
  )
  if (!cats[0]) throw new ValidationError(`Category not found: ${input.categoryId}`)

  // Slug uniqueness within the parent category
  const { rows: existing } = await db.query<{ id: string }>(
    `SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2 LIMIT 1`,
    [input.slug, input.categoryId],
  )
  if (existing[0]) {
    throw new AppError(409, `Slug "${input.slug}" is already taken in this category`, 'SLUG_CONFLICT')
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const { rows: inserted } = await client.query<{
      id: string; slug: string; sort_order: number; is_active: boolean
    }>(
      `
      INSERT INTO subcategories (category_id, slug, sort_order, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id, slug, sort_order, is_active
      `,
      [input.categoryId, input.slug, input.sortOrder],
    )
    const sub = inserted[0]

    await client.query(
      `
      INSERT INTO subcategory_translations (subcategory_id, locale, name, description)
      VALUES ($1, 'en', $2, $3)
      ON CONFLICT (subcategory_id, locale) DO UPDATE SET
        name        = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at  = now()
      `,
      [sub.id, input.name, nullify(input.description)],
    )

    await client.query('COMMIT')

    return {
      id:          sub.id,
      slug:        sub.slug,
      name:        input.name,
      description: nullify(input.description),
      categoryId:  input.categoryId,
      sortOrder:   sub.sort_order,
      isActive:    sub.is_active,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Subcategory: update ──────────────────────────────────────────────────────

export async function updateSubcategory(
  subcategoryId: string,
  input: UpdateSubcategoryInput,
): Promise<AdminSubcategoryResponseDTO> {
  const { rows: found } = await db.query<{ id: string; slug: string; category_id: string }>(
    `SELECT id, slug, category_id FROM subcategories WHERE id = $1 LIMIT 1`,
    [subcategoryId],
  )
  if (!found[0]) throw new NotFoundError('Subcategory')
  const existing = found[0]

  const targetCategoryId = input.categoryId ?? existing.category_id

  // If moving to a new parent, verify it exists and is active
  if (input.categoryId && input.categoryId !== existing.category_id) {
    const { rows: cats } = await db.query<{ id: string }>(
      `SELECT id FROM categories WHERE id = $1 AND is_active = true LIMIT 1`,
      [input.categoryId],
    )
    if (!cats[0]) throw new ValidationError(`Category not found: ${input.categoryId}`)
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Slug uniqueness within target category (excluding self)
    const newSlug = input.slug ?? existing.slug
    if (
      (input.slug      && input.slug      !== existing.slug)       ||
      (input.categoryId && input.categoryId !== existing.category_id)
    ) {
      const { rows: slugCheck } = await client.query<{ id: string }>(
        `SELECT id FROM subcategories WHERE slug = $1 AND category_id = $2 AND id != $3 LIMIT 1`,
        [newSlug, targetCategoryId, subcategoryId],
      )
      if (slugCheck[0]) {
        throw new AppError(409, `Slug "${newSlug}" is already taken in this category`, 'SLUG_CONFLICT')
      }
    }

    // Dynamic SET for subcategories table
    const setClauses: string[] = []
    const params: unknown[]    = []
    let   i = 1

    function addField(column: string, value: unknown) {
      setClauses.push(`${column} = $${i++}`)
      params.push(value)
    }

    if (input.slug       !== undefined) addField('slug',        input.slug)
    if (input.categoryId !== undefined) addField('category_id', input.categoryId)
    if (input.sortOrder  !== undefined) addField('sort_order',  input.sortOrder)
    if (input.isActive   !== undefined) addField('is_active',   input.isActive)

    setClauses.push(`updated_at = now()`)

    if (setClauses.length > 1) {
      params.push(subcategoryId)
      await client.query(
        `UPDATE subcategories SET ${setClauses.join(', ')} WHERE id = $${i}`,
        params,
      )
    }

    // Upsert translation
    if (input.name !== undefined || input.description !== undefined) {
      const { rows: ct } = await client.query<{ name: string | null; description: string | null }>(
        `SELECT name, description FROM subcategory_translations WHERE subcategory_id = $1 AND locale = 'en' LIMIT 1`,
        [subcategoryId],
      )
      const current = ct[0] ?? {}

      await client.query(
        `
        INSERT INTO subcategory_translations (subcategory_id, locale, name, description)
        VALUES ($1, 'en', $2, $3)
        ON CONFLICT (subcategory_id, locale) DO UPDATE SET
          name        = EXCLUDED.name,
          description = EXCLUDED.description,
          updated_at  = now()
        `,
        [
          subcategoryId,
          input.name        ?? current.name,
          input.description !== undefined ? nullify(input.description) : current.description,
        ],
      )
    }

    await client.query('COMMIT')

    // Return final state
    const { rows: final } = await db.query<{
      id: string; slug: string; name: string | null; description: string | null
      category_id: string; sort_order: number; is_active: boolean
    }>(
      `
      SELECT s.id, s.slug, st.name, st.description, s.category_id, s.sort_order, s.is_active
      FROM   subcategories s
      LEFT JOIN subcategory_translations st ON st.subcategory_id = s.id AND st.locale = 'en'
      WHERE  s.id = $1 LIMIT 1
      `,
      [subcategoryId],
    )
    const f = final[0]

    return {
      id:          f.id,
      slug:        f.slug,
      name:        f.name ?? f.slug,
      description: f.description,
      categoryId:  f.category_id,
      sortOrder:   f.sort_order,
      isActive:    f.is_active,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Subcategory: deactivate ──────────────────────────────────────────────────

export async function deactivateSubcategory(subcategoryId: string): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE subcategories SET is_active = false, updated_at = now() WHERE id = $1`,
    [subcategoryId],
  )
  if (!rowCount) throw new NotFoundError('Subcategory')
}