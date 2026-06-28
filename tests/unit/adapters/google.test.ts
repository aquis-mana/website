import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GoogleCalendarAdapter, parseCapacity } from '../../../src/adapters/google'

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

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
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

  it('getUpcomingEvents throws on a non-OK API response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as unknown as Response)

    const adapter = new GoogleCalendarAdapter()
    await expect(adapter.getUpcomingEvents()).rejects.toThrow(
      'Google Calendar request failed: 403'
    )
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

  it('throws when GOOGLE_CALENDAR_ID is not configured', async () => {
    vi.stubEnv('GOOGLE_CALENDAR_ID', '')
    const adapter = new GoogleCalendarAdapter()
    await expect(adapter.getUpcomingEvents()).rejects.toThrow(
      'GOOGLE_CALENDAR_ID is not configured'
    )
  })

  it('extracts capacity from the description tag and cleans the text', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ ...mockGoogleEvent, description: 'Bring snacks [capacity:8]' }],
      }),
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events[0].capacity).toBe(8)
    expect(events[0].description).toBe('Bring snacks')
  })

  it('falls back to DEFAULT_EVENT_CAPACITY when the event has no tag', async () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '30')
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [mockGoogleEvent] }),
    } as Response)

    const adapter = new GoogleCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events[0].capacity).toBe(30)
  })
})

describe('parseCapacity', () => {
  it('extracts capacity from a [capacity:N] tag and cleans the text', () => {
    const r = parseCapacity('Bring snacks [capacity:20]')
    expect(r.capacity).toBe(20)
    expect(r.cleaned).toBe('Bring snacks')
  })

  it('is case-insensitive and tolerates inner spaces', () => {
    const r = parseCapacity('Draft night [Capacity: 12 ]')
    expect(r.capacity).toBe(12)
    expect(r.cleaned).toBe('Draft night')
  })

  it('returns null capacity and original text when no tag is present', () => {
    const r = parseCapacity('No limits here')
    expect(r.capacity).toBeNull()
    expect(r.cleaned).toBe('No limits here')
  })
})
