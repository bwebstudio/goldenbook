import { describe, it, expect } from 'vitest'
import { pct, toCohortRows, windowComplete } from '../retention'

describe('windowComplete', () => {
  // Cohort week Mon 2026-09-28 .. Sun 2026-10-04.
  const week = '2026-09-28'

  it('D1 needs the day after the last member joined to be over', () => {
    expect(windowComplete(week, 1, '2026-10-05')).toBe(false) // Monday is still running
    expect(windowComplete(week, 1, '2026-10-06')).toBe(true)
  })

  it('D1-7 needs a full week after the last join', () => {
    expect(windowComplete(week, 7, '2026-10-11')).toBe(false)
    expect(windowComplete(week, 7, '2026-10-12')).toBe(true)
  })

  it('D8-30 needs thirty days after the last join', () => {
    expect(windowComplete(week, 30, '2026-11-03')).toBe(false)
    expect(windowComplete(week, 30, '2026-11-04')).toBe(true)
  })

  it('handles month and year boundaries in UTC', () => {
    expect(windowComplete('2026-12-28', 7, '2027-01-11')).toBe(true)
    expect(windowComplete('2026-12-28', 7, '2027-01-10')).toBe(false)
  })
})

describe('pct', () => {
  it('rounds to one decimal', () => {
    expect(pct(1, 3)).toBe(33.3)
    expect(pct(2, 3)).toBe(66.7)
  })

  it('returns null without a denominator, never 0%', () => {
    expect(pct(0, 0)).toBeNull()
  })
})

describe('toCohortRows', () => {
  it('reports complete windows and leaves pending ones null', () => {
    const rows = toCohortRows([
      { week: '2026-08-31', users: 13, d1: 3, d1to7: 6, d8to30: 3 },
      { week: '2026-09-28', users: 43, d1: 5, d1to7: 7, d8to30: 0 },
      { week: '2026-10-05', users: 32, d1: 0, d1to7: 0, d8to30: 0 },
    ], '2026-10-09')

    expect(rows[0]).toEqual({ week: '2026-08-31', users: 13, d1Pct: 23.1, d1to7Pct: 46.2, d8to30Pct: 23.1 })
    expect(rows[1]).toEqual({ week: '2026-09-28', users: 43, d1Pct: 11.6, d1to7Pct: null, d8to30Pct: null })
    expect(rows[2]).toEqual({ week: '2026-10-05', users: 32, d1Pct: null, d1to7Pct: null, d8to30Pct: null })
  })

  it('an empty cohort has no shares even when mature', () => {
    const [row] = toCohortRows([{ week: '2026-07-20', users: 0, d1: 0, d1to7: 0, d8to30: 0 }], '2026-10-09')
    expect(row.d1Pct).toBeNull()
    expect(row.d8to30Pct).toBeNull()
  })
})
