// ─── COLORS ──────────────────────────────────────────────────────────────────
// Sourced from design mockups (discover_editorial, place_detail_editorial)
export const colors = {
  // Primary editorial palette
  primary: '#D2B68A',      // Champagne Gold — labels, accents, CTAs
  navy: {
    DEFAULT: '#222D52',    // Deep navy — dark backgrounds, bold text
    light: '#2E3D6B',
    dark: '#161E38',
  },
  ivory: {
    DEFAULT: '#FDFDFB',    // Near-white background
    soft: '#F9F7F2',       // Slightly warm background for tip cards
  },
  // Legacy (kept for backward compat)
  gold: {
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
  },
  ink: {
    DEFAULT: '#0A0A0A',
    soft: '#1A1A1A',
    muted: '#2A2A2A',
  },
  cream: {
    DEFAULT: '#F8F5F0',
    soft: '#FAF8F4',
  },
} as const;

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────────
export const typography = {
  // Font families — Playfair Display + Inter (loaded in _layout.tsx)
  serif: 'PlayfairDisplay_400Regular',
  serifItalic: 'PlayfairDisplay_400Regular_Italic',
  serifBold: 'PlayfairDisplay_700Bold',
  sans: 'Inter_400Regular',
  sansLight: 'Inter_300Light',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',

  // Font sizes (px)
  display: 32,             // City hero name, place name
  title: 24,               // Section titles, card titles
  subtitle: 20,            // Hero subtitles
  body: 16,                // Body copy
  bodySmall: 14,           // Cards, secondary text
  caption: 12,             // Metadata, tags
  label: 10,               // Uppercase labels, badges

  // Font weights
  light: '300' as const,
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,

  // Letter spacing
  tight: -0.5,
  normal: 0,
  wide: 1.5,
  wider: 3,
  widest: 5,               // Uppercase labels
} as const;

// ─── SPACING ─────────────────────────────────────────────────────────────────
export const spacing = {
  // Scale (4pt grid)
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,

  // Semantic
  screenPadding: 24,       // px-6 — all screen edges
  sectionGap: 24,          // py-6 — between sections
  cardGap: 16,             // gap between cards
  cardPadding: 20,         // internal card padding
} as const;

// ─── RADIUS ──────────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,                   // Tags, pills
  md: 12,                  // Small cards
  lg: 16,                  // rounded-2xl — standard cards
  xl: 20,                  // Large cards
  full: 9999,              // Buttons, avatars
} as const;

// ─── ELEVATION ───────────────────────────────────────────────────────────────
export const elevation = {
  card: {
    shadowColor: '#222D52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  hero: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  overlay: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 50,
    elevation: 12,
  },
  // Soft shadow from code.html: box-shadow 0 10px 30px -10px rgba(34,45,82,0.08)
  soft: {
    shadowColor: '#222D52',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
} as const;

// ─── OVERLAYS ────────────────────────────────────────────────────────────────
export const overlays = {
  // Hero image overlays (gradient simulation)
  heroNavy: 'rgba(34,45,82,0.95)',    // bottom of hero
  heroNavyMid: 'rgba(34,45,82,0.4)', // mid hero
  heroTop: 'rgba(0,0,0,0.5)',         // top of hero for back buttons
  heroLight: 'rgba(0,0,0,0.35)',      // light overlay

  // Glass morphism
  glass: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.20)',
} as const;
