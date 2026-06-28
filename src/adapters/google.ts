import type { CalendarAdapter, CalendarEvent } from './calendar'
import { resolveCapacity } from './calendar'

interface GoogleEventItem {
  id: string
  summary?: string
  description?: string
  start: { dateTime?: string; date?: string }
  location?: string
}

export function parseCapacity(description: string): { capacity: number | null; cleaned: string } {
  const match = description.match(/\[capacity:\s*(\d+)\s*\]/i)
  if (!match) return { capacity: null, cleaned: description }
  const capacity = Number.parseInt(match[1], 10)
  const cleaned = description.replace(match[0], '').replace(/ {2,}/g, ' ').trim()
  return { capacity, cleaned }
}

function mapGoogleEvent(item: GoogleEventItem): CalendarEvent {
  const { capacity, cleaned } = parseCapacity(item.description ?? '')
  return {
    id: item.id,
    title: item.summary ?? '(Kein Titel)',
    description: cleaned,
    date: new Date(item.start.dateTime ?? item.start.date ?? ''),
    location: item.location ?? '',
    imageUrl: null,
    capacity: resolveCapacity(capacity),
    capacityWarningThreshold: null,
  }
}

export class GoogleCalendarAdapter implements CalendarAdapter {
  private async fetchEvents(): Promise<CalendarEvent[]> {
    const calendarId = process.env.GOOGLE_CALENDAR_ID
    const apiKey = process.env.GOOGLE_CALENDAR_API_KEY
    if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID is not configured')
    if (!apiKey) throw new Error('GOOGLE_CALENDAR_API_KEY is not configured')

    const timeMin = new Date().toISOString()
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events` +
      `?key=${apiKey}&timeMin=${timeMin}&orderBy=startTime&singleEvents=true&maxResults=50`

    console.log('[google] fetching upcoming events')
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`[google] events.list failed: ${res.status} ${body}`)
      throw new Error(`Google Calendar request failed: ${res.status}`)
    }
    const data = await res.json()
    const items: GoogleEventItem[] = data.items ?? []
    console.log(`[google] fetched ${items.length} events`)
    return items.map(mapGoogleEvent)
  }

  async getUpcomingEvents(): Promise<CalendarEvent[]> {
    return this.fetchEvents()
  }

  async getEvent(id: string): Promise<CalendarEvent | null> {
    const events = await this.fetchEvents()
    return events.find((e) => e.id === id) ?? null
  }
}
