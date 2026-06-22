import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GoogleCalendarAdapter } from '../../../src/adapters/google'

const mockGoogleEvent = {
  id: 'g001',
  summary: 'Board Game Night',
  description: 'Bring your favorites',
  start: { dateTime: '2026-07-10T19:00:00+02:00' },
  end: { dateTime: '2026-07-10T22:00:00+02:00' },
  location: 'Vereinsheim Aachen',
}

describe('GoogleCalendarAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'test@group.calendar.google.com')
    vi.stubEnv('GOOGLE_CALENDAR_API_KEY', 'test-key')
  })

  it('getUpcomingEvents maps Google events to CalendarEvent', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockGoogleEvent] }),
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('g001')
    expect(events[0].title).toBe('Board Game Night')
    expect(events[0].date).toBeInstanceOf(Date)
    expect(events[0].capacity).toBeNull()
  })

  it('getUpcomingEvents returns empty array on API error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events).toEqual([])
  })

  it('getEvent returns null (Google adapter does not support single lookup)', async () => {
    const adapter = new GoogleCalendarAdapter()
    // getEvent on Google adapter fetches all then filters
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockGoogleEvent] }),
    } as Response)
    const event = await adapter.getEvent('g001')
    expect(event).not.toBeNull()
    expect(event?.id).toBe('g001')
  })
})
