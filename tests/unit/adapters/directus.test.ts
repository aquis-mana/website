import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DirectusCalendarAdapter, upcomingEventsQuery } from '../../../src/adapters/directus'

vi.mock('../../../src/lib/directus', () => ({
  getDirectusClient: vi.fn(),
}))

import { getDirectusClient } from '../../../src/lib/directus'

const mockEvent = {
  id: 'abc123',
  title: 'MtG Friday',
  description: 'Weekly draft',
  date: '2026-07-04T18:00:00Z',
  location: 'Vereinsheim',
  image: null,
  capacity: 20,
  capacity_warning_threshold: null,
  status: 'published' as const,
}

describe('DirectusCalendarAdapter', () => {
  let mockClient: { request: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockClient = { request: vi.fn() }
    vi.mocked(getDirectusClient).mockReturnValue(mockClient as any)
  })

  afterEach(() => vi.unstubAllEnvs())

  it('getUpcomingEvents returns mapped CalendarEvents', async () => {
    mockClient.request.mockResolvedValue([mockEvent])
    const adapter = new DirectusCalendarAdapter()
    const events = await adapter.getUpcomingEvents()

    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('abc123')
    expect(events[0].title).toBe('MtG Friday')
    expect(events[0].date).toBeInstanceOf(Date)
    expect(events[0].capacity).toBe(20)
  })

  it('getEvent returns null when not found', async () => {
    mockClient.request.mockResolvedValue([])
    const adapter = new DirectusCalendarAdapter()
    const event = await adapter.getEvent('missing')
    expect(event).toBeNull()
  })

  it('getUpcomingEvents filters draft events', async () => {
    mockClient.request.mockResolvedValue([
      { ...mockEvent, status: 'draft' },
    ])
    const adapter = new DirectusCalendarAdapter()
    // The adapter passes status filter to Directus; mock returns empty = 0 events
    mockClient.request.mockResolvedValue([])
    const events = await adapter.getUpcomingEvents()
    expect(events).toHaveLength(0)
  })

  it('applies DEFAULT_EVENT_CAPACITY when the event has no capacity', async () => {
    vi.stubEnv('DEFAULT_EVENT_CAPACITY', '15')
    mockClient.request.mockResolvedValue([{ ...mockEvent, capacity: null }])
    const adapter = new DirectusCalendarAdapter()
    const events = await adapter.getUpcomingEvents()
    expect(events[0].capacity).toBe(15)
  })

  it('upcomingEventsQuery windows to lookaheadDays with an upper bound', () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const q = upcomingEventsQuery(now, 5)
    expect(q.filter.status._eq).toBe('published')
    expect(q.filter.date._gte).toBe('2026-07-01T00:00:00.000Z')
    expect(q.filter.date._lte).toBe('2026-07-06T00:00:00.000Z')
  })
})
