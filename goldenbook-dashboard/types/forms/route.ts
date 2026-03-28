// Form value types and validation for the route create/edit form.

export interface RouteFormValues {
  title:            string
  slug:             string
  summary:          string
  body:             string
  citySlug:         string
  routeType:        string
  estimatedMinutes: string  // kept as string for <input> binding; parsed on submit
  featured:         boolean
  status:           'draft' | 'published' | 'archived'
}

// A stop as represented inside the form (includes display data for the card).
export interface RouteFormStop {
  id:          string  // place UUID — used in the API payload
  slug:        string
  name:        string
  note:        string  // empty string when absent
  image:       string | null
  city:        string | null
}

export type RouteFormErrors = Partial<Record<keyof RouteFormValues, string>>

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const EMPTY_ROUTE_FORM: RouteFormValues = {
  title:            '',
  slug:             '',
  summary:          '',
  body:             '',
  citySlug:         '',
  routeType:        'walking',
  estimatedMinutes: '',
  featured:         false,
  status:           'draft',
}

// ─── Validation ───────────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateRouteForm(values: RouteFormValues): RouteFormErrors {
  const errors: RouteFormErrors = {}

  if (!values.title.trim()) {
    errors.title = 'Title is required.'
  } else if (values.title.trim().length < 2) {
    errors.title = 'Title must be at least 2 characters.'
  }

  if (!values.slug.trim()) {
    errors.slug = 'Slug is required.'
  } else if (!SLUG_RE.test(values.slug.trim())) {
    errors.slug = 'Slug must use only lowercase letters, numbers, and hyphens.'
  }

  if (!values.citySlug) {
    errors.citySlug = 'Please select a city for this route.'
  }

  if (values.estimatedMinutes !== '') {
    const n = Number(values.estimatedMinutes)
    if (!Number.isInteger(n) || n < 0) {
      errors.estimatedMinutes = 'Duration must be a whole number of minutes (e.g. 90).'
    }
  }

  return errors
}

export function isRouteFormValid(errors: RouteFormErrors): boolean {
  return Object.keys(errors).length === 0
}