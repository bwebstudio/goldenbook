type ClassValue = string | undefined | null | false | 0

export function cn(...inputs: ClassValue[]) {
  return inputs
    .flat()
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function priceRangeLabel(range?: 1 | 2 | 3 | 4): string {
  if (!range) return ''
  return '€'.repeat(range)
}

export function buildImageUrl(path: string): string {
  // If already an absolute URL, return as-is
  if (path.startsWith('http')) return path
  const base = process.env.NEXT_PUBLIC_STORAGE_URL ?? ''
  return `${base}${path}`
}
