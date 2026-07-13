import { readItems } from '@directus/sdk'
import { getDirectusClient } from '../lib/directus'
import { resolveCapacity, type CalendarAdapter, type CalendarEvent } from './calendar'
import { createLogger } from '../lib/logger'

const log = createLogger('directus')

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
    // Directus is private and unreachable from the browser, so route images
    // through the public /cms-assets proxy (same as documents in dokumente.astro).
    imageUrl: raw.image ? `/cms-assets/${raw.image}` : null,
    capacity: resolveCapacity(raw.capacity),
    capacityWarningThreshold: raw.capacity_warning_threshold,
  }
}

export class DirectusCalendarAdapter implements CalendarAdapter {
  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    const client = getDirectusClient()
    const now = new Date().toISOString()
    log.debug('fetching upcoming events')
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
      log.info(`fetched ${items.length} events`)
      return items.map(mapEvent)
    } catch (err) {
      log.error('getUpcomingEvents failed', err)
      throw err
    }
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const client = getDirectusClient()
    log.debug(`fetching event ${id}`)
    try {
      const items = await client.request(
        readItems('events', {
          filter: { id: { _eq: id }, status: { _eq: 'published' } },
          limit: 1,
        })
      )
      return items.length > 0 ? mapEvent(items[0]) : null
    } catch (err) {
      log.error(`getEvent(${id}) failed`, err)
      throw err
    }
  }
}
