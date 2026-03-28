// Raw backend request/response types for the categories endpoints.
// Match the backend DTOs exactly — do not use these directly in UI components.

// ── GET /api/v1/admin/categories ──────────────────────────────────────────────

export interface AdminSubcategoryListItemDTO {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  sortOrder:   number;
  isActive:    boolean;
}

export interface AdminCategoryDTO {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  iconName:    string | null;
  sortOrder:   number;
  isActive:    boolean;
  subcategories: AdminSubcategoryListItemDTO[];
}

export interface AdminCategoriesResponseDTO {
  items: AdminCategoryDTO[];
}

// ── POST /api/v1/admin/categories ─────────────────────────────────────────────

export interface CreateCategoryPayload {
  name:        string;
  slug:        string;
  description?: string;
  iconName?:   string;
  sortOrder?:  number;
}

// ── PUT /api/v1/admin/categories/:id ─────────────────────────────────────────

export interface UpdateCategoryPayload {
  name?:        string;
  slug?:        string;
  description?: string;
  iconName?:    string;
  sortOrder?:   number;
  isActive?:    boolean;
}

// Response from POST and PUT /api/v1/admin/categories
export interface AdminCategoryResponseDTO {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  iconName:    string | null;
  sortOrder:   number;
  isActive:    boolean;
}

// ── POST /api/v1/admin/subcategories ─────────────────────────────────────────

export interface CreateSubcategoryPayload {
  name:        string;
  slug:        string;
  description?: string;
  categoryId:  string;
  sortOrder?:  number;
}

// ── PUT /api/v1/admin/subcategories/:id ──────────────────────────────────────

export interface UpdateSubcategoryPayload {
  name?:        string;
  slug?:        string;
  description?: string;
  categoryId?:  string;
  sortOrder?:   number;
  isActive?:    boolean;
}

// Response from POST and PUT /api/v1/admin/subcategories
export interface AdminSubcategoryResponseDTO {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  categoryId:  string;
  sortOrder:   number;
  isActive:    boolean;
}