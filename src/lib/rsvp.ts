import { createItem, readItems, updateItem } from '@directus/sdk'
import { getDirectusClient } from './directus'

export interface RsvpRecord {
  id: string
  eventId: string
  name: string
  status: 'yes' | 'maybe' | 'cancelled'
  visitorToken: string
}

export interface RsvpStats {
  yes: number
  maybe: number
  total: number
  capacity: number | null
  isNearFull: boolean
  isOverFull: boolean
}

function mapRsvp(raw: {
  id: string; event_id: string; name: string
  status: 'yes' | 'maybe' | 'cancelled'; visitor_token: string
}): RsvpRecord {
  return {
    id: raw.id,
    eventId: raw.event_id,
    name: raw.name,
    status: raw.status,
    visitorToken: raw.visitor_token,
  }
}

export async function createRsvp(
  eventId: string,
  name: string,
  status: 'yes' | 'maybe',
  visitorToken: string
): Promise<RsvpRecord> {
  const client = getDirectusClient()
  const raw = await client.request(
    createItem('rsvps', {
      event_id: eventId,
      name,
      status,
      visitor_token: visitorToken,
      member_id: null,
    })
  )
  return mapRsvp(raw as any)
}

export async function updateRsvp(
  visitorToken: string,
  status: 'yes' | 'maybe'
): Promise<RsvpRecord> {
  const client = getDirectusClient()
  const existing = await client.request(
    readItems('rsvps', {
      filter: { visitor_token: { _eq: visitorToken }, status: { _neq: 'cancelled' } },
      limit: 1,
    })
  )
  if (!existing.length) throw new Error('RSVP not found')
  const raw = await client.request(updateItem('rsvps', existing[0].id, { status }))
  return mapRsvp(raw as any)
}

export async function cancelRsvp(visitorToken: string): Promise<void> {
  const client = getDirectusClient()
  const existing = await client.request(
    readItems('rsvps', {
      filter: { visitor_token: { _eq: visitorToken }, status: { _neq: 'cancelled' } },
      limit: 1,
    })
  )
  if (!existing.length) return
  await client.request(updateItem('rsvps', existing[0].id, { status: 'cancelled' }))
}

export async function getRsvpStats(
  eventId: string,
  capacity: number | null,
  warningThreshold?: number | null
): Promise<RsvpStats> {
  const client = getDirectusClient()
  const items = await client.request(
    readItems('rsvps', {
      filter: { event_id: { _eq: eventId } },
      fields: ['status'],
    })
  )

  const yes = (items as Array<{ status: string }>).filter((r) => r.status === 'yes').length
  const maybe = (items as Array<{ status: string }>).filter((r) => r.status === 'maybe').length
  const total = yes + maybe

  let isNearFull = false
  let isOverFull = false

  if (capacity !== null) {
    isOverFull = total > capacity
    const remaining = capacity - total
    const threshold = warningThreshold ?? Math.max(Math.floor(capacity * 0.1), 5)
    isNearFull = !isOverFull && remaining <= threshold
  }

  return { yes, maybe, total, capacity, isNearFull, isOverFull }
}
