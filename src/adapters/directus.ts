import { readItems } from '@directus/sdk'
import { getDirectusClient } from '../lib/directus'
import { resolveCapacity, type CalendarAdapter, type CalendarEvent } from './calendar'
import { createLogger } from '../lib/logger'
import { config } from '../lib/config'

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

/**
 * Query for published events from now through the look-ahead window. Mirrors the
 * Google adapter's EVENT_LOOKAHEAD_DAYS windowing so both sources agree.
 */
export function upcomingEventsQuery(now: Date, lookaheadDays: number) {
  const timeMax = new Date(now.getTime() + lookaheadDays * 86_400_000)
  return {
    filter: {
      status: { _eq: 'published' as const },
      date: { _gte: now.toISOString(), _lte: timeMax.toISOString() },
    },
    // Typed as a field-literal array so the Directus SDK accepts it once the
    // query is extracted here (inline it would be narrowed by contextual typing).
    sort: ['date'] as ('date')[],
  }
}

export class DirectusCalendarAdapter implements CalendarAdapter {
  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    const client = getDirectusClient()
    log.debug('fetching upcoming events')
    try {
      const items = await client.request(
        readItems('events', upcomingEventsQuery(new Date(), config.eventLookaheadDays))
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
