import { describe, it, expect } from 'vitest'
import { formatEventDateTime } from '../../../src/lib/datetime'

// A Berlin summer event (CEST, UTC+2): 19:00 local == 17:00Z
const iso = '2026-07-10T19:00:00+02:00'

describe('formatEventDateTime', () => {
  it('formats the instant in the given timeZone (Europe/Berlin)', () => {
    const { time } = formatEventDateTime(iso, 'de', 'Europe/Berlin')
    expect(time).toBe('19:00')
  })

  it('formats the same instant differently in UTC (proving tz is applied)', () => {
    const { time } = formatEventDateTime(iso, 'de', 'UTC')
    expect(time).toBe('17:00')
  })

  it('accepts a Date object as well as an ISO string', () => {
    const fromDate = formatEventDateTime(new Date(iso), 'de', 'Europe/Berlin')
    const fromStr = formatEventDateTime(iso, 'de', 'Europe/Berlin')
    expect(fromDate).toEqual(fromStr)
  })

  it('uses the requested locale for the date label', () => {
    const de = formatEventDateTime(iso, 'de', 'Europe/Berlin').date
    const en = formatEventDateTime(iso, 'en', 'Europe/Berlin').date
    expect(de).not.toBe(en)
    expect(de).toContain('2026')
    expect(en).toContain('2026')
  })
})
