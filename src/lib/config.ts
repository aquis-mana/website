function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseIntEnvOrNull(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Central, typed access to environment configuration.
 *
 * Every field is a getter that reads process.env on access. This keeps values
 * current for tests that stub env, and keeps adapter-specific vars lazy (they
 * may be absent depending on CALENDAR_SOURCE). This is an SSR app, so
 * process.env is the correct source at runtime for both public and private vars.
 */
export const config = {
  get calendarSource(): 'directus' | 'google' {
    return process.env.CALENDAR_SOURCE === 'google' ? 'google' : 'directus'
  },
  get eventLookaheadDays(): number {
    return parseIntEnv(process.env.EVENT_LOOKAHEAD_DAYS, 7)
  },
  get defaultEventCapacity(): number | null {
    return parseIntEnvOrNull(process.env.DEFAULT_EVENT_CAPACITY)
  },
  get directusUrl(): string | undefined {
    return process.env.DIRECTUS_URL
  },
  get directusToken(): string {
    return process.env.DIRECTUS_TOKEN ?? ''
  },
  get googleCalendarId(): string | undefined {
    return process.env.GOOGLE_CALENDAR_ID
  },
  get googleApiKey(): string | undefined {
    return process.env.GOOGLE_CALENDAR_API_KEY
  },
  get turnstileSiteKey(): string {
    return process.env.PUBLIC_TURNSTILE_SITE_KEY ?? ''
  },
  get turnstileSecretKey(): string | undefined {
    return process.env.TURNSTILE_SECRET_KEY
  },
}
