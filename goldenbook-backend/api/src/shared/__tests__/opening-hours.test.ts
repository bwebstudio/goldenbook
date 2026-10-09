import { describe, it, expect } from 'vitest'
import {
  isOpenAt, isOpenNow, localClock, minutesUntil, cityTimezone,
  openingRowOpenSql, type OpeningHoursRow,
} from '../opening-hours'
import { minutesUntilClose } from '../../modules/plan/plan.query'

const SUN = 0, MON = 1, FRI = 5, SAT = 6
const row = (day_of_week: number, opens_at: string, closes_at: string): OpeningHoursRow =>
  ({ day_of_week, opens_at, closes_at, is_closed: false })
const closedRow = (day_of_week: number): OpeningHoursRow =>
  ({ day_of_week, opens_at: null, closes_at: null, is_closed: true })
const m = (hhmm: string) => {
  const [h, mm] = hhmm.split(':').map(Number)
  return h * 60 + mm
}

describe('isOpenAt: overnight Friday 22:00-02:00', () => {
  const bar = [row(FRI, '22:00', '02:00:00')]

  it('Fri 23:30 is open (today, after opening)', () => {
    expect(isOpenAt(bar, FRI, m('23:30'))).toBe(true)
  })
  it('Sat 00:30 is open (yesterday\'s interval spills over)', () => {
    expect(isOpenAt(bar, SAT, m('00:30'))).toBe(true)
  })
  it('Sat 02:30 is closed', () => {
    expect(isOpenAt(bar, SAT, m('02:30'))).toBe(false)
  })
  it('Sat 02:00 is closed (close is exclusive)', () => {
    expect(isOpenAt(bar, SAT, m('02:00'))).toBe(false)
  })
  it('Fri 21:59 is closed, Fri 00:30 is closed (Thursday has no row)', () => {
    expect(isOpenAt(bar, FRI, m('21:59'))).toBe(false)
    expect(isOpenAt(bar, FRI, m('00:30'))).toBe(false)
  })
  it('Saturday-night interval spills into Sunday (week wrap)', () => {
    expect(isOpenAt([row(SAT, '23:00', '03:00')], SUN, m('01:00'))).toBe(true)
  })
})

describe('isOpenAt: closing at midnight', () => {
  const restaurant = [row(FRI, '19:00', '00:00')]

  it('stored as 00:00 means end of day', () => {
    expect(isOpenAt(restaurant, FRI, m('19:00'))).toBe(true)
    expect(isOpenAt(restaurant, FRI, m('23:59'))).toBe(true)
  })
  it('is closed from 00:00 the next day', () => {
    expect(isOpenAt(restaurant, SAT, m('00:00'))).toBe(false)
    expect(isOpenAt(restaurant, SAT, m('00:30'))).toBe(false)
  })
  it('24h convention 00:00-23:59 covers the last minute too', () => {
    expect(isOpenAt([row(FRI, '00:00', '23:59')], FRI, m('23:59'))).toBe(true)
  })
})

describe('isOpenAt: normal hours, split shifts, closed and unknown', () => {
  const lunchDinner = [row(MON, '12:00', '15:00'), row(MON, '19:00', '23:00')]

  it('normal intervals keep working', () => {
    expect(isOpenAt(lunchDinner, MON, m('12:00'))).toBe(true)
    expect(isOpenAt(lunchDinner, MON, m('16:00'))).toBe(false)
    expect(isOpenAt(lunchDinner, MON, m('22:59'))).toBe(true)
    expect(isOpenAt(lunchDinner, MON, m('23:00'))).toBe(false)
  })
  it('a closed row never opens', () => {
    expect(isOpenAt([closedRow(MON)], MON, m('12:00'))).toBe(false)
  })
  it('a closed day does not cancel yesterday\'s spill-over', () => {
    expect(isOpenAt([row(FRI, '22:00', '02:00'), closedRow(SAT)], SAT, m('01:00'))).toBe(true)
  })
  it('no rows at all is unknown (null), not closed', () => {
    expect(isOpenAt([], MON, m('12:00'))).toBeNull()
  })
})

describe('time zone', () => {
  const bar = [row(FRI, '22:00', '02:00')]

  it('maps destinations to their zone', () => {
    expect(cityTimezone('lisboa')).toBe('Europe/Lisbon')
    expect(cityTimezone('porto')).toBe('Europe/Lisbon')
    expect(cityTimezone('madeira')).toBe('Atlantic/Madeira')
    expect(cityTimezone('nowhere')).toBe('Europe/Lisbon')
  })

  it('evaluates in local time, not UTC: Fri 23:30 UTC in summer is Sat 00:30 in Lisbon', () => {
    const at = new Date('2026-07-10T23:30:00Z') // Friday in UTC
    expect(localClock('Europe/Lisbon', at)).toMatchObject({ dow: SAT, hour: 0, minute: 30 })
    expect(isOpenNow(bar, 'Europe/Lisbon', at)).toBe(true)
    // At Fri 21:30 UTC it is 22:30 in Lisbon: open there, closed by UTC reading
    const early = new Date('2026-07-10T21:30:00Z')
    expect(isOpenNow(bar, 'Europe/Lisbon', early)).toBe(true)
    expect(isOpenNow(bar, 'UTC', early)).toBe(false)
  })

  it('Madeira shares Lisbon\'s offset (WET/WEST), unlike the Azores', () => {
    for (const iso of ['2026-07-10T21:30:00Z', '2026-12-11T21:30:00Z']) {
      const at = new Date(iso)
      expect(localClock('Atlantic/Madeira', at)).toEqual(localClock('Europe/Lisbon', at))
    }
    expect(localClock('Atlantic/Azores', new Date('2026-07-10T21:30:00Z')).hour).toBe(21) // Lisbon: 22
  })

  it('DST end (Sun 25 Oct 2026): 00:30 and 01:30 UTC are both 01:30 local, open on Saturday\'s interval', () => {
    const sat = [row(SAT, '22:00', '02:00')]
    for (const iso of ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z']) {
      expect(localClock('Europe/Lisbon', new Date(iso))).toMatchObject({ dow: SUN, hour: 1, minute: 30 })
      expect(isOpenNow(sat, 'Europe/Lisbon', new Date(iso))).toBe(true)
    }
    expect(isOpenNow(sat, 'Europe/Lisbon', new Date('2026-10-25T02:00:00Z'))).toBe(false)
  })

  it('DST start (Sun 29 Mar 2026): 01:30 UTC is already 02:30 local, past a 02:00 close', () => {
    const sat = [row(SAT, '22:00', '02:00')]
    expect(isOpenNow(sat, 'Europe/Lisbon', new Date('2026-03-29T00:30:00Z'))).toBe(true)
    expect(isOpenNow(sat, 'Europe/Lisbon', new Date('2026-03-29T01:30:00Z'))).toBe(false)
  })
})

describe('minutes until close', () => {
  it('wraps past midnight', () => {
    expect(minutesUntil('02:00', m('23:30'))).toBe(150)
    expect(minutesUntil('00:00', m('23:30'))).toBe(30)
    expect(minutesUntil('02:00', m('00:30'))).toBe(90)
  })
  it('a close that just passed is closed, not 24h away', () => {
    expect(minutesUntil('21:00', m('21:00'))).toBeNull()
    expect(minutesUntil('21:00', m('21:03'))).toBeNull()
  })
  it('null input is null', () => {
    expect(minutesUntil(null, 0)).toBeNull()
  })
  it('plan uses the city clock: open until 02:00 at Fri 23:30 Lisbon leaves 150 min', () => {
    expect(minutesUntilClose('02:00', 'Europe/Lisbon', new Date('2026-07-10T22:30:00Z'))).toBe(150)
  })
})

describe('openingRowOpenSql', () => {
  it('checks both today\'s row and yesterday\'s overnight row', () => {
    const sql = openingRowOpenSql('oh', 'L')
    expect(sql).toContain('oh.closes_at <= oh.opens_at')
    expect(sql).toContain('(EXTRACT(DOW FROM L)::int + 6) % 7')
    expect(sql).toContain('oh.closes_at < oh.opens_at')
  })
})
