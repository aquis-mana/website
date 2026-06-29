/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY: string
  readonly CALENDAR_SOURCE?: string
  readonly DIRECTUS_URL?: string
  readonly DIRECTUS_TOKEN?: string
  readonly GOOGLE_CALENDAR_ID?: string
  readonly GOOGLE_CALENDAR_API_KEY?: string
  readonly TURNSTILE_SECRET_KEY?: string
}

declare namespace App {
  interface Locals {
    /** Per-request CSP nonce set by middleware; apply to inline <script> tags. */
    cspNonce: string
  }
}
