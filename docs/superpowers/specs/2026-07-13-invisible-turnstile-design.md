# Invisible Turnstile — Design

Date: 2026-07-13

## Goal

Keep the page-level Cloudflare Turnstile check on the main page, but hide it
**entirely** — no floating badge, no interactive checkbox, ever — while still
protecting the RSVP endpoint from bot spam.

## Background

Turnstile has historically been rendered on the home page (`#page-turnstile`)
and its token is read only when a visitor submits an RSVP
(`RsvpOverlay` → `POST /api/rsvp` → `verifyTurnstile`).

A previous change (`321ce5d`, "remove cloudflare banner") set
`appearance: 'interaction-only'`. That hides the widget *unless* Cloudflare
decides the visitor needs the interactive challenge — in which case the widget
surfaces (the "tiny banner in the lower left" that prompted this work). So
`interaction-only` does not achieve full invisibility on a **Managed** widget.

## Decision

Switch the Turnstile widget to **Invisible** mode.

- The widget **mode** is a property of the sitekey, set in the Cloudflare
  dashboard — it cannot be forced from client code. On a Managed sitekey an
  interactive challenge can appear regardless of the `appearance` option.
- In **Invisible** mode the widget never renders UI and never requires
  interaction: it either passes silently (producing a token) or yields no
  token. Cloudflare Turnstile does not require a visible badge for invisible
  widgets, so full invisibility is supported.

**Dashboard prerequisite (completed):** the sitekey behind
`PUBLIC_TURNSTILE_SITE_KEY` has been switched to Invisible mode. Site and secret
keys are unchanged, so no env/secret changes are needed.

### Rejected alternative: CSS-hide a Managed widget

Hiding a Managed widget with CSS would break RSVP for any visitor Cloudflare
flags: the challenge would be present but invisible, so the visitor could not
solve it, would get no token, and their RSVP would fail. Invisible mode avoids
this by never needing interaction.

## Accepted tradeoff

Invisible mode has **no interactive fallback**, so a determined bot is more
likely to pass than under Managed mode. This is accepted in exchange for a
banner-free UX on a low-risk club site. The RSVP endpoint still verifies every
token server-side, so forged/absent tokens are rejected.

## Implementation

Primarily `src/pages/index.astro` (the inline Turnstile setup script), plus a
one-line hook call in `src/components/RsvpOverlay.astro` (step 3).

1. Render the widget in invisible mode — drop `appearance: 'interaction-only'`.
   The invisible widget auto-executes on load and populates the
   `cf-turnstile-response` value.
2. Add an `expired-callback` that re-executes the widget, so a valid token is
   available even if the page sits open past the token lifetime (~5 min).
3. When the RSVP dialog opens, reset/re-execute the widget so submit always has
   a fresh token. Wiring: the Turnstile widget is rendered in `index.astro`'s
   inline script, which captures the widget id from `turnstile.render(...)` and
   exposes `window.refreshTurnstile = () => turnstile.reset(widgetId)`.
   `RsvpOverlay`'s `openOverlay()` calls `window.refreshTurnstile?.()`. Guard for
   the hook being absent (e.g. Turnstile script blocked) so the dialog still
   opens.

No changes to `RsvpOverlay` submit logic or `/api/rsvp`: the token is still read
from `cf-turnstile-response` and verified by `verifyTurnstile`. If invisible
verification produced no token, the existing "please try again" error path
handles it.

## Testing

- **Manual/verify:** load the home page — no widget or badge visible anywhere;
  open the RSVP dialog and submit — RSVP succeeds (token present).
- The existing Playwright RSVP specs (overlay open/close) continue to pass.
- No new automated test is added for the invisible render itself, since it
  depends on Cloudflare's runtime challenge decision, which can't be asserted
  deterministically in CI.

## Out of scope

The larger "site-wide preflight gate" and Cloudflare edge Managed Challenge
options that were discussed are **not** part of this change. This is only the
invisible page-level widget.
