import { z } from 'zod'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// ─── Category schemas ──────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters'),
  slug:        z.string().min(1, 'Slug is required').regex(SLUG_RE, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  iconName:    z.string().optional(),
  sortOrder:   z.number().int().min(0).default(0),
})

export const updateCategorySchema = z.object({
  name:        z.string().min(2).optional(),
  slug:        z.string().regex(SLUG_RE).optional(),
  description: z.string().optional(),
  iconName:    z.string().optional(),
  sortOrder:   z.number().int().min(0).optional(),
  isActive:    z.boolean().optional(),
})

// ─── Subcategory schemas ───────────────────────────────────────────────────────

export const createSubcategorySchema = z.object({
  name:        z.string().min(2, 'Name must be at least 2 characters'),
  slug:        z.string().min(1, 'Slug is required').regex(SLUG_RE, 'Slug must be lowercase letters, numbers, and hyphens only'),
  description: z.string().optional(),
  categoryId:  z.string().uuid('categoryId must be a valid UUID'),
  sortOrder:   z.number().int().min(0).default(0),
})

export const updateSubcategorySchema = z.object({
  name:        z.string().min(2).optional(),
  slug:        z.string().regex(SLUG_RE).optional(),
  description: z.string().optional(),
  categoryId:  z.string().uuid().optional(), // allows moving to a different parent
  sortOrder:   z.number().int().min(0).optional(),
  isActive:    z.boolean().optional(),
})

export type CreateCategoryInput    = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput    = z.infer<typeof updateCategorySchema>
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export interface AdminCategoryResponseDTO {
  id:          string
  slug:        string
  name:        string
  description: string | null
  iconName:    string | null
  sortOrder:   number
  isActive:    boolean
}

export interface AdminSubcategoryResponseDTO {
  id:          string
  slug:        string
  name:        string
  description: string | null
  categoryId:  string
  sortOrder:   number
  isActive:    boolean
}