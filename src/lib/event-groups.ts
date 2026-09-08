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
 * occurrence is useful. Dedup keys on the (normalised) title rather than the
 * series id: "TCG - Open Play" runs Mon–Fri as five separate weekly Google
 * events, and the members think of it as one thing. One-off events are all
 * kept. Events are grouped in the given `timeZone` (Europe/Berlin for SSR);
 * each list is sorted ascending.
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
  const seenRecurringTitles = new Set<string>()
  const titleKey = (event: CalendarEvent) => event.title.trim().toLowerCase()

  for (const event of byDate) {
    const isRecurring = event.seriesId !== null

    if (dayKey(event.date, timeZone) === todayKey) {
      today.push(event)
      if (isRecurring) seenRecurringTitles.add(titleKey(event))
      continue
    }
    if (event.date.getTime() < now.getTime()) continue // past, and not today

    if (isRecurring) {
      if (seenRecurringTitles.has(titleKey(event))) continue
      seenRecurringTitles.add(titleKey(event))
      upcoming.push(event)
    } else {
      other.push(event)
    }
  }

  return { today, upcoming, other }
}
