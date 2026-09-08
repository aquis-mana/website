/**
 * Format an event's absolute instant for display.
 *
 * The instant itself is unambiguous (Google Calendar `dateTime` carries a UTC
 * offset). What varies is the zone used to render it:
 *  - On the client we pass no `timeZone`, so the visitor's browser zone is used.
 *  - On the server (SSR) the pod runs in UTC, so we must pass an explicit zone;
 *    we use `Europe/Berlin` as the fallback, matching the club's locale.
 */
export function formatEventDateTime(
  date: Date | string,
  lang: 'de' | 'en',
  timeZone?: string
): { date: string; time: string } {
  const d = typeof date === 'string' ? new Date(date) : date
  const locale = lang === 'de' ? 'de-DE' : 'en-GB'

  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  }
  if (timeZone) {
    dateOpts.timeZone = timeZone
    timeOpts.timeZone = timeZone
  }

  return {
    date: d.toLocaleDateString(locale, dateOpts),
    time: d.toLocaleTimeString(locale, timeOpts),
  }
}

/**
 * Compact time label for the front-page event list. The variant controls how
 * much context is shown, matching each section:
 *  - `time`    → "18:30"                  (Heute — the day is implied)
 *  - `weekday` → "Mi 18:30"               (Anstehend — within the coming days)
 *  - `full`    → "23.11.2026 So 11:00"    (Andere Veranstaltungen — further out)
 *
 * Zone handling mirrors `formatEventDateTime`: pass `Europe/Berlin` for SSR,
 * omit `timeZone` on the client to use the visitor's own zone.
 */
export type EventTimeVariant = 'time' | 'weekday' | 'full'

export function formatEventListTime(
  date: Date | string,
  lang: 'de' | 'en',
  variant: EventTimeVariant,
  timeZone?: string
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const locale = lang === 'de' ? 'de-DE' : 'en-GB'
  const tz: { timeZone?: string } = timeZone ? { timeZone } : {}

  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', ...tz })
  if (variant === 'time') return time

  // de-DE renders short weekdays with a trailing dot ("Mi."); drop it.
  const weekday = d
    .toLocaleDateString(locale, { weekday: 'short', ...tz })
    .replace(/\.$/, '')
  if (variant === 'weekday') return `${weekday} ${time}`

  const day = d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...tz,
  })
  return `${day} ${weekday} ${time}`
}
