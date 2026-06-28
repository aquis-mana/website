import { readItems } from '@directus/sdk'
import { getDirectusClient } from '../lib/directus'
import { resolveCapacity, type CalendarAdapter, type CalendarEvent } from './calendar'

function mapEvent(raw: {
  id: string
  title: string
  description: string
  date: string
  location: string
  image: string | null
  capacity: number | null
  capacity_warning_threshold: number | null
}): CalendarEvent {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    date: new Date(raw.date),
    location: raw.location,
    imageUrl: raw.image
      ? `${process.env.DIRECTUS_URL}/assets/${raw.image}`
      : null,
    capacity: resolveCapacity(raw.capacity),
    capacityWarningThreshold: raw.capacity_warning_threshold,
  }
}

export class DirectusCalendarAdapter implements CalendarAdapter {
  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    const client = getDirectusClient()
    const now = new Date().toISOString()
    console.log('[directus] fetching upcoming events')
    try {
      const items = await client.request(
        readItems('events', {
          filter: {
            status: { _eq: 'published' },
            date: { _gte: now },
          },
          sort: ['date'],
        })
      )
      console.log(`[directus] fetched ${items.length} events`)
      return items.map(mapEvent)
    } catch (err) {
      console.error('[directus] getUpcomingEvents failed:', err)
      throw err
    }
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const client = getDirectusClient()
    console.log(`[directus] fetching event ${id}`)
    try {
      const items = await client.request(
        readItems('events', {
          filter: { id: { _eq: id }, status: { _eq: 'published' } },
          limit: 1,
        })
      )
      return items.length > 0 ? mapEvent(items[0]) : null
    } catch (err) {
      console.error(`[directus] getEvent(${id}) failed:`, err)
      throw err
    }
  }
}
