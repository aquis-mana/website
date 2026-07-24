import { createItem, readItems, updateItem } from '@directus/sdk'
import { getDirectusClient } from './directus'

export interface RsvpRecord {
  id: string
  eventId: string
  name: string
  status: 'yes' | 'maybe' | 'cancelled'
  visitorToken: string
}

export interface RsvpAttendee {
  name: string
  status: 'yes' | 'maybe'
}

export interface RsvpStats {
  yes: number
  maybe: number
  total: number
  capacity: number | null
  isNearFull: boolean
  isOverFull: boolean
  /** Names of everyone signed up, "yes" before "maybe", each group A→Z. */
  attendees: RsvpAttendee[]
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

/** The active (non-cancelled) RSVP for a visitor token, or null. */
export async function findActiveRsvp(visitorToken: string) {
  const client = getDirectusClient()
  const items = await client.request(
    readItems('rsvps', {
      filter: { visitor_token: { _eq: visitorToken }, status: { _neq: 'cancelled' } },
      limit: 1,
    })
  )
  return items[0] ?? null
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
  return mapRsvp(raw)
}

export async function updateRsvp(
  visitorToken: string,
  status: 'yes' | 'maybe'
): Promise<RsvpRecord> {
  const existing = await findActiveRsvp(visitorToken)
  if (!existing) throw new Error('RSVP not found')
  const client = getDirectusClient()
  const raw = await client.request(updateItem('rsvps', existing.id, { status }))
  return mapRsvp(raw)
}

export async function cancelRsvp(visitorToken: string): Promise<void> {
  const existing = await findActiveRsvp(visitorToken)
  if (!existing) return
  const client = getDirectusClient()
  await client.request(updateItem('rsvps', existing.id, { status: 'cancelled' }))
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
      fields: ['status', 'name'],
    })
  )

  const yes = items.filter((r) => r.status === 'yes').length
  const maybe = items.filter((r) => r.status === 'maybe').length
  const total = yes + maybe

  const collator = new Intl.Collator('de')
  const attendees: RsvpAttendee[] = items
    .filter((r): r is { status: 'yes' | 'maybe'; name: string } =>
      r.status === 'yes' || r.status === 'maybe'
    )
    .map((r) => ({ name: (r.name ?? '').trim(), status: r.status }))
    .filter((a) => a.name.length > 0)
    .sort((a, b) =>
      a.status === b.status
        ? collator.compare(a.name, b.name)
        : a.status === 'yes' ? -1 : 1
    )

  let isNearFull = false
  let isOverFull = false

  if (capacity !== null) {
    isOverFull = total > capacity
    const remaining = capacity - total
    const threshold = warningThreshold ?? Math.max(Math.floor(capacity * 0.1), 5)
    isNearFull = !isOverFull && remaining <= threshold
  }

  return { yes, maybe, total, capacity, isNearFull, isOverFull, attendees }
}
