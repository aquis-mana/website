import type { CalendarAdapter, CalendarEvent } from './calendar'

interface GoogleEventItem {
  id: string
  summary?: string
  description?: string
  start: { dateTime?: string; date?: string }
  location?: string
}

function mapGoogleEvent(item: GoogleEventItem): CalendarEvent {
  return {
    id: item.id,
    title: item.summary ?? '(Kein Titel)',
    description: item.description ?? '',
    date: new Date(item.start.dateTime ?? item.start.date ?? ''),
    location: item.location ?? '',
    imageUrl: null,
    capacity: null,
    capacityWarningThreshold: null,
  }
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  private async fetchEvents(): Promise<CalendarEvent[]> {
    const calendarId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID ?? '')
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY
    const timeMin = new Date().toISOString()
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&timeMin=${timeMin}&orderBy=startTime&singleEvents=true&maxResults=50`

    const res = await fetch(url)
    if (!res.ok) return []

    const data = await res.json()
    return (data.items ?? []).map(mapGoogleEvent)
  }

  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    return this.fetchEvents()
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const events = await this.fetchEvents()
    return events.find((e) => e.id === id) ?? null
  }
}
