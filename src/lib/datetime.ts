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
