import type { CalendarEvent } from '../adapters/calendar'

export interface GroupedEvents {
  /** Everything happening today (recurring instance or one-off). */
  today: CalendarEvent[]
  /** Next upcoming instance of each recurring series, excluding today. */
  upcoming: CalendarEvent[]
  /** One-off events within the look-ahead window, excluding today. */
  other: CalendarEvent[]
}

/** Local calendar day (YYYY-MM-DD) of an instant in the given zone. */
function dayKey(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone })
}

/**
 * Split calendar events into the three front-page sections.
 *
 * Recurring events (`seriesId !== null`) are deduped to their earliest future
 * instance — the club runs the same game nights every week, and only the next
 * occurrence is useful. One-off events are all kept. Events are grouped in the
 * given `timeZone` (Europe/Berlin for SSR); each list is sorted ascending.
 */
export function groupEvents(
  events: CalendarEvent[],
  now: Date,
  timeZone: string
): GroupedEvents {
  const todayKey = dayKey(now, timeZone)
  const byDate = [...events].sort((a, b) => a.date.getTime() - b.date.getTime())

  const today: CalendarEvent[] = []
  const upcoming: CalendarEvent[] = []
  const other: CalendarEvent[] = []
  const seenSeries = new Set<string>()

  for (const event of byDate) {
    if (dayKey(event.date, timeZone) === todayKey) {
      today.push(event)
      if (event.seriesId) seenSeries.add(event.seriesId)
      continue
    }
    if (event.date.getTime() < now.getTime()) continue // past, and not today

    if (event.seriesId) {
      if (seenSeries.has(event.seriesId)) continue
      seenSeries.add(event.seriesId)
      upcoming.push(event)
    } else {
      other.push(event)
    }
  }

  return { today, upcoming, other }
}
