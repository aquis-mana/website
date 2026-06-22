/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY: string
}

declare namespace NodeJS {
  interface ProcessEnv {
    CALENDAR_SOURCE?: 'directus' | 'google'
    DIRECTUS_URL?: string
    DIRECTUS_TOKEN?: string
    GOOGLE_CALENDAR_ID?: string
    GOOGLE_CALENDAR_API_KEY?: string
    TURNSTILE_SECRET_KEY?: string
  }
}
