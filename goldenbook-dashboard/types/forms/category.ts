// Form value types for the category create/edit form.

export interface CategoryFormValues {
  name:             string;
  slug:             string;
  description:      string;
  iconName:         string;
  sortOrder:        string;  // kept as string for input binding, parsed to number on submit
  isActive:         boolean;
  parentCategoryId: string;  // empty string = main category (no parent)
}

export interface CategoryFormErrors {
  name?:      string;
  slug?:      string;
  sortOrder?: string;
}

export const EMPTY_CATEGORY_FORM: CategoryFormValues = {
  name:             "",
  slug:             "",
  description:      "",
  iconName:         "",
  sortOrder:        "0",
  isActive:         true,
  parentCategoryId: "",
};

// Validates category form values. Returns an errors object (empty = valid).
export function validateCategoryForm(values: CategoryFormValues): CategoryFormErrors {
  const errors: CategoryFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Category name is required.";
  } else if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  if (!values.slug.trim()) {
    errors.slug = "Slug is required.";
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.slug.trim())) {
    errors.slug = "Slug may only contain lowercase letters, numbers, and hyphens (e.g. fine-dining).";
  }

  const order = Number(values.sortOrder);
  if (values.sortOrder !== "" && (isNaN(order) || order < 0 || !Number.isInteger(order))) {
    errors.sortOrder = "Sort order must be a whole number, 0 or higher.";
  }

  return errors;
}

// Derives a slug from a display name (lowercase, hyphens, no special chars).
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}