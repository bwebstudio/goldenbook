// UI-layer types for categories — mapped from backend DTOs.
// These are the shapes used in components, not the raw API responses.

export interface UISubcategory {
  id:          string;
  slug:        string;
  name:        string;
  description: string | null;
  parentId:    string;
  parentName:  string;
  sortOrder:   number;
  isActive:    boolean;
}

export interface UICategory {
  id:             string;
  slug:           string;
  name:           string;
  description:    string | null;
  iconName:       string | null;
  sortOrder:      number;
  isActive:       boolean;
  subcategoryCount: number;
  subcategories:  UISubcategory[];
}