export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night'

export function getTimeSlot(date?: Date): TimeSlot {
  const hour = (date ?? new Date()).getHours()

  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 23) return 'evening'
  return 'night'
}
