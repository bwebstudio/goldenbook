/**
 * Interest catalog — single source of truth.
 *
 * Shared between the Onboarding (interests picker) and Preferences screens.
 * The id is what gets persisted in onboardingStore and sent to the Discover
 * API; the labelKey is a reference into the `onboarding` i18n section so
 * there is never a parallel list of hard-coded labels in any screen.
 *
 * Adding a new interest: add it here, then add the matching `interest*`
 * key to every `src/i18n/locales/*.ts` file. TypeScript enforces parity.
 */

import type { Ionicons } from '@expo/vector-icons';
import type { Translations } from '@/i18n/locales/en';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface InterestItem {
  /** Stable slug. Persisted and sent to backend. */
  id: string;
  /** Key inside `onboarding.*` in the translation files. */
  labelKey: keyof Translations['onboarding'];
  /** Ionicons name rendered inside the chip. */
  icon: IoniconName;
}

/**
 * Full interest catalog. Preferences shows all of these; Onboarding shows
 * a curated subset (see ONBOARDING_INTEREST_IDS below) because the first
 * screen of the app needs to feel focused and fast.
 */
export const INTERESTS: InterestItem[] = [
  { id: 'gastronomy',    labelKey: 'interestGastronomy',   icon: 'restaurant-outline'    },
  { id: 'fine-dining',   labelKey: 'interestFineDining',   icon: 'wine-outline'          },
  { id: 'wine',          labelKey: 'interestWine',         icon: 'wine-outline'          },
  { id: 'cocktails',     labelKey: 'interestCocktails',    icon: 'beer-outline'          },
  { id: 'cafes',         labelKey: 'interestCafes',        icon: 'cafe-outline'          },
  { id: 'pastries',      labelKey: 'interestPastries',     icon: 'color-palette-outline' },
  { id: 'culture',       labelKey: 'interestCulture',      icon: 'color-palette-outline' },
  { id: 'art',           labelKey: 'interestArt',          icon: 'brush-outline'         },
  { id: 'architecture',  labelKey: 'interestArchitecture', icon: 'business-outline'      },
  { id: 'design',        labelKey: 'interestDesign',       icon: 'grid-outline'          },
  { id: 'nature',        labelKey: 'interestNature',       icon: 'leaf-outline'          },
  { id: 'beaches',       labelKey: 'interestBeaches',      icon: 'sunny-outline'         },
  { id: 'wellness',      labelKey: 'interestWellness',     icon: 'water-outline'         },
  { id: 'shopping',      labelKey: 'interestShopping',     icon: 'bag-outline'           },
  { id: 'nightlife',     labelKey: 'interestNightlife',    icon: 'moon-outline'          },
  { id: 'hidden-gems',   labelKey: 'interestHiddenGems',   icon: 'sparkles-outline'      },
  { id: 'family',        labelKey: 'interestFamily',       icon: 'people-outline'        },
  { id: 'romantic',      labelKey: 'interestRomantic',     icon: 'heart-outline'         },
  { id: 'hotels',        labelKey: 'interestHotels',       icon: 'bed-outline'           },
  { id: 'history',       labelKey: 'interestHistory',      icon: 'business-outline'      },
];

/**
 * Curated subset shown in the Onboarding interests picker.
 * Order is intentional — it drives first-impression feel on screen 1.
 */
export const ONBOARDING_INTEREST_IDS = [
  'fine-dining',
  'wine',
  'culture',
  'hidden-gems',
  'hotels',
  'nature',
  'nightlife',
  'wellness',
  'shopping',
  'history',
] as const;

/**
 * Interest catalog filtered to the onboarding subset, in the order above.
 */
export const ONBOARDING_INTERESTS: InterestItem[] = ONBOARDING_INTEREST_IDS
  .map((id) => INTERESTS.find((i) => i.id === id))
  .filter((i): i is InterestItem => !!i);
