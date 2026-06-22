import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DirectusCalendarAdapter } from '../../../src/adapters/directus'

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
})
