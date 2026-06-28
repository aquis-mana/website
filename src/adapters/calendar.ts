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
  const source = process.env.CALENDAR_SOURCE ?? 'directus'
  console.log(`[calendar] using adapter: ${source}`)
  if (source === 'google') {
    const { GoogleCalendarAdapter } = await import('./google')
    return new GoogleCalendarAdapter()
  }
  const { DirectusCalendarAdapter } = await import('./directus')
  return new DirectusCalendarAdapter()
}

export function resolveCapacity(explicit: number | null): number | null {
  if (explicit !== null) return explicit
  const raw = process.env.DEFAULT_EVENT_CAPACITY
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}
