import { createLogger } from '../lib/logger'
import { config } from '../lib/config'

const log = createLogger('calendar')

export interface CalendarEvent {
  id: string
  title: string
  description: string
  date: Date
  location: string
  imageUrl: string | null
  capacity: number | null
  capacityWarningThreshold: number | null
}

export interface CalendarAdapter {
  getUpcomingEvents(): Promise<CalendarEvent[]>
  getEvent(id: string): Promise<CalendarEvent | null>
}

export async function getAdapter(): Promise<CalendarAdapter> {
  const source = config.calendarSource
  log.debug(`using adapter: ${source}`)
  if (source === 'google') {
    const { GoogleCalendarAdapter } = await import('./google')
    return new GoogleCalendarAdapter()
  }
  const { DirectusCalendarAdapter } = await import('./directus')
  return new DirectusCalendarAdapter()
}

export function resolveCapacity(explicit: number | null): number | null {
  if (explicit !== null) return explicit
  return config.defaultEventCapacity
}
