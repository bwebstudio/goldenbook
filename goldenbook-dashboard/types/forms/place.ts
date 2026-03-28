// Form value types for the place edit/create form.
// Separate from API types (types/api/) and UI display types (types/ui/).

export interface PlaceFormValues {
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  goldenbookNote: string;
  whyWeLoveIt: string;
  insiderTip: string;
  /** City slug — used as the API key. Displayed as city name in the dropdown. */
  citySlug: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  bookingUrl: string;
  /** Primary category slug. */
  categorySlug: string;
  /** Optional subcategory slug. */
  subcategorySlug: string;
  /** Matches the backend DB status values (no "featured" — use the featured toggle instead). */
  status: "draft" | "published" | "archived";
  featured: boolean;
  /** NOTE: editorsPick has no DB column yet — sent in payload but not persisted by the backend. */
  editorsPick: boolean;
}

export type PlaceFormErrors = Partial<Record<keyof PlaceFormValues, string>>;

export const EMPTY_PLACE_FORM: PlaceFormValues = {
  name: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  goldenbookNote: "",
  whyWeLoveIt: "",
  insiderTip: "",
  citySlug: "",
  address: "",
  website: "",
  phone: "",
  email: "",
  bookingUrl: "",
  categorySlug: "",
  subcategorySlug: "",
  status: "published",
  featured: false,
  editorsPick: false,
};

// ── Validation ──────────────────────────────────────────────────────────────

const URL_RE = /^https?:\/\/.+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Returns a map of field → error message. Empty object means valid. */
export function validatePlaceForm(
  values: PlaceFormValues,
  isEditing: boolean
): PlaceFormErrors {
  const errors: PlaceFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Place name is required.";
  } else if (values.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  // Slug is auto-generated but still validated
  if (values.slug && !SLUG_RE.test(values.slug)) {
    errors.slug =
      "Slug must contain only lowercase letters, numbers, and hyphens (e.g. my-place).";
  }
  if (!isEditing && !values.slug.trim()) {
    errors.slug = "Slug is required.";
  }

  if (!values.citySlug) {
    errors.citySlug = "Please select a city.";
  }

  if (!values.categorySlug) {
    errors.categorySlug = "Please select a category.";
  }

  if (!values.status) {
    errors.status = "Please select a status.";
  }

  if (values.website && !URL_RE.test(values.website)) {
    errors.website = "Website must be a valid URL starting with http:// or https://.";
  }

  if (values.email && !EMAIL_RE.test(values.email)) {
    errors.email = "Please enter a valid email address.";
  }

  if (
    values.bookingUrl &&
    !URL_RE.test(values.bookingUrl) &&
    !/^\+?[\d\s\-().]{6,}$/.test(values.bookingUrl)
  ) {
    errors.bookingUrl =
      "Enter a valid URL (https://...) or phone number for reservations.";
  }

  return errors;
}

/** Returns true if the form has any validation errors. */
export function isFormValid(errors: PlaceFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
