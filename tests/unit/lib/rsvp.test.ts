import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRsvp, updateRsvp, cancelRsvp, getRsvpStats } from '../../../src/lib/rsvp'

vi.mock('../../../src/lib/directus', () => ({ getDirectusClient: vi.fn() }))
vi.mock('@directus/sdk', () => ({
  createItem: vi.fn((col: string, data: unknown) => ({ _tag: 'create', col, data })),
  readItems: vi.fn((col: string, opts: unknown) => ({ _tag: 'read', col, opts })),
  updateItem: vi.fn((col: string, id: string, data: unknown) => ({ _tag: 'update', col, id, data })),
}))

import { getDirectusClient } from '../../../src/lib/directus'

describe('createRsvp', () => {
  it('calls directus createItem with correct fields', async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      id: 'r1', event_id: 'e1', name: 'Alice', status: 'yes', visitor_token: 'tok1', member_id: null,
    })
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const result = await createRsvp('e1', 'Alice', 'yes', 'tok1')
    expect(result.eventId).toBe('e1')
    expect(result.name).toBe('Alice')
    expect(result.status).toBe('yes')
    expect(mockRequest).toHaveBeenCalled()
  })
})

describe('getRsvpStats', () => {
  it('counts yes and maybe, excludes cancelled', async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { status: 'yes' }, { status: 'yes' }, { status: 'maybe' }, { status: 'cancelled' },
    ])
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const stats = await getRsvpStats('e1', 10)
    expect(stats.yes).toBe(2)
    expect(stats.maybe).toBe(1)
    expect(stats.total).toBe(3)
    expect(stats.capacity).toBe(10)
    expect(stats.isNearFull).toBe(false)
    expect(stats.isOverFull).toBe(false)
  })

  it('isOverFull when total > capacity', async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { status: 'yes' }, { status: 'yes' }, { status: 'yes' },
    ])
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const stats = await getRsvpStats('e1', 2)
    expect(stats.isOverFull).toBe(true)
  })

  it('isNearFull when ≤5 spots remain', async () => {
    const mockRequest = vi.fn().mockResolvedValue(
      Array(16).fill({ status: 'yes' })
    )
    vi.mocked(getDirectusClient).mockReturnValue({ request: mockRequest } as any)

    const stats = await getRsvpStats('e1', 20)
    expect(stats.isNearFull).toBe(true)
    expect(stats.isOverFull).toBe(false)
  })
})
