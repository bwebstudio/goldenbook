// ─── Premium thin-line category icons ────────────────────────────────────────
// stroke-based SVGs (strokeWidth 1.5) aligned with the Goldenbook editorial
// visual language. Keys match backend `icon_name` values exactly (PascalCase).

interface IconProps {
  className?: string
}

// ─── Icon definitions ─────────────────────────────────────────────────────────

// PeopleIcon → Stay & Do (activities)
function PeopleIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
    </svg>
  )
}

// BeachIcon → Nature (beaches)
function BeachIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="5" r="2" />
      <path d="M3 19c1-4 4-7 9-7s8 3 9 7" />
      <path d="M12 12v3" />
      <path d="M7 17c1-1.5 2.5-2 5-2s4 .5 5 2" />
      <line x1="2" x2="22" y1="22" y2="22" />
    </svg>
  )
}

// HandsIcon → Culture (culture)
function HandsIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="2" x2="22" y1="20" y2="20" />
      <line x1="2" x2="22" y1="9" y2="9" />
      <path d="m3 9 9-7 9 7" />
      <line x1="4" x2="4" y1="9" y2="20" />
      <line x1="9" x2="9" y1="9" y2="20" />
      <line x1="15" x2="15" y1="9" y2="20" />
      <line x1="20" x2="20" y1="9" y2="20" />
    </svg>
  )
}

// CalendarIcon → Events
function CalendarIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  )
}

// PlateIcon → Food & Drinks (gastronomy)
function PlateIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 5V2" />
      <path d="M5.05 5.05 3 3" />
      <path d="M18.95 5.05 21 3" />
      <path d="M3 13H1" />
      <path d="M23 13h-2" />
      <path d="M12 13v-4" />
    </svg>
  )
}

// ShopIcon → Shopping
function ShopIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

// SwimmerIcon → Sports
function SwimmerIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="17" cy="4" r="1.5" />
      <path d="M5.83 10.83 8 9l4 2 3-4" />
      <path d="M2 18c2 0 4-1 6-1s4 1 6 1 4-1 6-1" />
      <path d="M2 22c2 0 4-1 6-1s4 1 6 1 4-1 6-1" />
      <path d="m13 7-2 5-3-1-3 3" />
    </svg>
  )
}

// ServicesIcon → Transport
function ServicesIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect width="16" height="13" x="4" y="3" rx="2" />
      <path d="M8 3v2M16 3v2" />
      <line x1="4" x2="20" y1="9" y2="9" />
      <path d="M8 16h.01M16 16h.01" />
      <path d="M9 20H7a1 1 0 0 1-1-1v-1h12v1a1 1 0 0 1-1 1h-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

// ─── Fallback icon ─────────────────────────────────────────────────────────────
function FallbackIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

// ─── Registry: exact DB icon_name values ──────────────────────────────────────
const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  PeopleIcon,
  BeachIcon,
  HandsIcon,
  CalendarIcon,
  PlateIcon,
  ShopIcon,
  SwimmerIcon,
  ServicesIcon,
}

// ─── Public component ─────────────────────────────────────────────────────────
interface CategoryIconProps {
  iconName: string | null
  className?: string
}

export function CategoryIcon({ iconName, className = 'w-6 h-6' }: CategoryIconProps) {
  if (!iconName) return <FallbackIcon className={className} />

  // Try exact match first (DB values are PascalCase like "PlateIcon")
  const ExactIcon = ICONS[iconName]
  if (ExactIcon) return <ExactIcon className={className} />

  // Fallback: case-insensitive prefix match
  const lower = iconName.toLowerCase()
  const matchKey = Object.keys(ICONS).find((k) => k.toLowerCase().startsWith(lower) || lower.startsWith(k.toLowerCase()))
  const Icon = matchKey ? ICONS[matchKey] : FallbackIcon
  return <Icon className={className} />
}
