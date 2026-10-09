// ─── place_type vs primary category sanity check ────────────────────────────
//
// The app's automatic tags and NOW windows are derived from places.place_type
// (auto-classify), while lists and filters use the editorial primary category.
// The two are set independently, so they can drift apart: a restaurant filed
// under "Alojamento" gets restaurant tags but shows up among hotels. This only
// flags the obvious contradictions; it never blocks a save and does not change
// how either value is used.

/**
 * Categories that make sense for each place_type. "experiences" is the
 * editorial catch-all and fits every type. Types missing here (activity,
 * other) are broad enough that no category is an obvious contradiction.
 */
const COMPATIBLE_CATEGORIES: Record<string, readonly string[]> = {
  restaurant: ["gastronomy", "experiences"],
  cafe:       ["gastronomy", "experiences"],
  bar:        ["gastronomy", "experiences"],
  hotel:      ["alojamento", "experiences"],
  shop:       ["retail", "experiences"],
  museum:     ["culture", "natureza-outdoor", "experiences"],
  landmark:   ["culture", "natureza-outdoor", "experiences"],
  beach:      ["natureza-outdoor", "experiences"],
  venue:      ["culture", "experiences"],
  transport:  ["mobilidade"],
};

/** Every category slug the table above knows; unknown slugs are never flagged. */
const KNOWN_CATEGORIES = new Set(Object.values(COMPATIBLE_CATEGORIES).flat());

export function isPlaceTypeCategoryMismatch(placeType: string | null | undefined, categorySlug: string | null | undefined): boolean {
  if (!placeType || !categorySlug) return false;
  const allowed = COMPATIBLE_CATEGORIES[placeType];
  if (!allowed || !KNOWN_CATEGORIES.has(categorySlug)) return false;
  return !allowed.includes(categorySlug);
}
