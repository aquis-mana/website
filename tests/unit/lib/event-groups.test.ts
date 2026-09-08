import { describe, it, expect } from 'vitest'
import { groupEvents } from '../../../src/lib/event-groups'
import type { CalendarEvent } from '../../../src/adapters/calendar'

function ev(opts: { id: string; date: string; seriesId?: string | null }): CalendarEvent {
  return {
    id: opts.id,
    title: opts.id,
    description: '',
    date: new Date(opts.date),
    location: '',
    imageUrl: null,
    capacity: null,
    capacityWarningThreshold: null,
    seriesId: opts.seriesId ?? null,
  }
}

const TZ = 'Europe/Berlin'
// A Tuesday afternoon in Berlin (CEST, UTC+2).
const NOW = new Date('2026-09-08T14:00:00+02:00')

describe('groupEvents', () => {
  it('puts events happening today into `today`, formatted by local day not UTC', () => {
    const events = [
      ev({ id: 'tonight', date: '2026-09-08T18:30:00+02:00' }),
      // 00:30 Berlin on the 9th is still 22:30Z on the 8th — must NOT count as today.
      ev({ id: 'tomorrow-early', date: '2026-09-09T00:30:00+02:00' }),
    ]
    const { today, other } = groupEvents(events, NOW, TZ)
    expect(today.map((e) => e.id)).toEqual(['tonight'])
    expect(other.map((e) => e.id)).toEqual(['tomorrow-early'])
  })

  it('dedupes a recurring series to its earliest future instance in `upcoming`', () => {
    const events = [
      ev({ id: 'wk3', date: '2026-09-23T18:30:00+02:00', seriesId: 's1' }),
      ev({ id: 'wk1', date: '2026-09-09T18:30:00+02:00', seriesId: 's1' }),
      ev({ id: 'wk2', date: '2026-09-16T18:30:00+02:00', seriesId: 's1' }),
    ]
    const { upcoming } = groupEvents(events, NOW, TZ)
    expect(upcoming.map((e) => e.id)).toEqual(['wk1'])
  })

  it("drops a series' future instances when it also runs today", () => {
    const events = [
      ev({ id: 'today', date: '2026-09-08T19:00:00+02:00', seriesId: 's1' }),
      ev({ id: 'next-week', date: '2026-09-15T19:00:00+02:00', seriesId: 's1' }),
    ]
    const { today, upcoming } = groupEvents(events, NOW, TZ)
    expect(today.map((e) => e.id)).toEqual(['today'])
    expect(upcoming).toHaveLength(0)
  })

  it('keeps every one-off event in `other`, sorted ascending', () => {
    const events = [
      ev({ id: 'nov', date: '2026-11-23T11:00:00+01:00' }),
      ev({ id: 'oct', date: '2026-10-04T11:00:00+02:00' }),
    ]
    const { other } = groupEvents(events, NOW, TZ)
    expect(other.map((e) => e.id)).toEqual(['oct', 'nov'])
  })

  it('discards events that are already in the past', () => {
    const events = [ev({ id: 'yesterday', date: '2026-09-07T19:00:00+02:00' })]
    const { today, upcoming, other } = groupEvents(events, NOW, TZ)
    expect([...today, ...upcoming, ...other]).toHaveLength(0)
  })

  it('returns three empty lists for no events', () => {
    expect(groupEvents([], NOW, TZ)).toEqual({ today: [], upcoming: [], other: [] })
  })
})
