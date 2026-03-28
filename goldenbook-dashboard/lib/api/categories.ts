import { apiDelete, apiGet, apiPost, apiPut } from "./client";
import type {
  AdminCategoryDTO,
  AdminCategoriesResponseDTO,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  AdminCategoryResponseDTO,
  CreateSubcategoryPayload,
  UpdateSubcategoryPayload,
  AdminSubcategoryResponseDTO,
} from "@/types/api/category";

// ── Read ──────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/categories
// Returns all categories (active + inactive) with their subcategories.
// Includes: id, slug, name, description, iconName, sortOrder, isActive.
export async function fetchCategories(): Promise<AdminCategoryDTO[]> {
  const data = await apiGet<AdminCategoriesResponseDTO>("/api/v1/admin/categories");
  return data.items;
}

// ── Category write ────────────────────────────────────────────────────────────

// POST /api/v1/admin/categories
export async function createCategory(payload: CreateCategoryPayload): Promise<AdminCategoryResponseDTO> {
  return apiPost<AdminCategoryResponseDTO>("/api/v1/admin/categories", payload);
}

// PUT /api/v1/admin/categories/:id
export async function updateCategory(id: string, payload: UpdateCategoryPayload): Promise<AdminCategoryResponseDTO> {
  return apiPut<AdminCategoryResponseDTO>(`/api/v1/admin/categories/${encodeURIComponent(id)}`, payload);
}

// DELETE /api/v1/admin/categories/:id — soft archive (sets is_active = false)
export async function deactivateCategory(id: string): Promise<void> {
  await apiDelete(`/api/v1/admin/categories/${encodeURIComponent(id)}`);
}

// ── Subcategory write ─────────────────────────────────────────────────────────

// POST /api/v1/admin/subcategories
export async function createSubcategory(payload: CreateSubcategoryPayload): Promise<AdminSubcategoryResponseDTO> {
  return apiPost<AdminSubcategoryResponseDTO>("/api/v1/admin/subcategories", payload);
}

// PUT /api/v1/admin/subcategories/:id
export async function updateSubcategory(id: string, payload: UpdateSubcategoryPayload): Promise<AdminSubcategoryResponseDTO> {
  return apiPut<AdminSubcategoryResponseDTO>(`/api/v1/admin/subcategories/${encodeURIComponent(id)}`, payload);
}

// DELETE /api/v1/admin/subcategories/:id — soft archive
export async function deactivateSubcategory(id: string): Promise<void> {
  await apiDelete(`/api/v1/admin/subcategories/${encodeURIComponent(id)}`);
}
