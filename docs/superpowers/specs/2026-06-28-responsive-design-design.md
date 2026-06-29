# Responsive Design Improvements — Design

**Date:** 2026-06-28
**Status:** Approved

## Goal

The Aquis Mana website should render cleanly across all screen sizes, from
~320px phones through desktop. The layout is already container-based
(`max-w-* mx-auto px-4`), so this is a targeted pass — fix the concrete gaps,
not a rewrite. Tailwind CSS v4 (via `@tailwindcss/vite`) is the styling system;
use its default breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

## Current state (audit)

- The whole codebase uses only two responsive utilities today
  (`sm:grid-cols-2`, `lg:grid-cols-3` on the event grid).
- The header nav (`Base.astro`) puts the brand plus five links in one
  horizontal row with no mobile treatment — it squishes/overflows on phones.
- The membership page (`mitgliedschaft.astro` and its `en/` mirror) renders a
  full `<table>` that can force horizontal overflow on narrow screens.
- The RSVP modal (`w-full max-w-md mx-4`) and event grid are already
  acceptable and are left unchanged.

## Components

### 1. Header navigation — hamburger on mobile (`src/layouts/Base.astro`)

Shared layout, so this fixes the nav for every page (DE and `/en`) at once.

- **Desktop (`md` and up):** the current horizontal link row is unchanged.
  Apply `hidden md:flex` to the existing `<ul>` of links.
- **Mobile (`< md`):** add a hamburger `<button>` (`md:hidden`) in the nav bar.
  Tapping it toggles a vertical dropdown panel containing the same links,
  including the DE/EN switch.
- **Markup:** a collapsible panel element with `id="mobile-menu"`, hidden by
  default (`hidden`), shown by toggling a class.
- **Behavior (plain inline `<script>`, matching the existing Turnstile/RSVP
  inline-script pattern — no framework):**
  - Toggle button shows/hides `#mobile-menu`.
  - Button carries `aria-controls="mobile-menu"` and `aria-expanded`, which the
    script keeps in sync (`"true"`/`"false"`).
  - Button has an `aria-label` (localized via the existing `t()` helper, e.g.
    `nav.menu`).
  - Clicking any link inside the panel closes it.
- **Accessibility:** focusable button, keyboard-activatable (native `<button>`),
  `aria-expanded` reflects state.

### 2. Membership table — horizontal scroll wrapper

File: `src/pages/mitgliedschaft.astro` only. (`en/mitgliedschaft.astro` is a
"content coming soon" stub with no table.)

Wrap the existing `<table>` in a `<div class="overflow-x-auto">` so the table
scrolls horizontally inside its column on narrow screens instead of widening the
page. No change to the table's data or structure.

### 3. General mobile polish (`src/layouts/Base.astro` + content pages)

- **Footer (`Base.astro`):** change the footer row to stack on narrow screens —
  `flex-col gap-2 sm:flex-row sm:justify-between` (keep `items-center` behavior
  appropriate to each axis).
- **Page headings:** scale the main `h1` down one step on mobile on the content
  pages that use a fixed large size — `text-2xl sm:text-3xl` (applies to
  `mitgliedschaft.astro`, `ueber-uns.astro`, `dokumente.astro` and their `/en`
  mirrors where an `h1` uses `text-3xl`).
- **Event grid / RSVP modal:** already responsive — no change.

## Internationalization

- The hamburger `aria-label` uses a new translation key (e.g. `nav.menu`) added
  to both `de` and `en` translation tables in `src/i18n/`.
- All other changes are class-only and language-agnostic.

## Scope

- In scope: `Base.astro` (nav + footer), both `mitgliedschaft` files (table),
  content-page `h1` sizing, one new i18n key.
- Out of scope (YAGNI / deferred): restructuring the membership table into
  stacked cards; the calendar-style event display (already tracked separately in
  `TODO.md`); any redesign of colors/typography beyond responsive sizing.

## Verification

Responsive behavior is visual, so verification combines a build check with an
automated viewport check:

1. `npm run build` (`astro build`) completes without errors.
2. A Playwright check (Playwright is already a dev dependency) loads the home
   page and the membership page at **375×667** (mobile) and **1280×800**
   (desktop) and asserts:
   - No horizontal overflow at mobile width
     (`document.documentElement.scrollWidth <= window.innerWidth + 1`).
   - At mobile width the desktop link row is hidden and the hamburger button is
     visible; clicking it reveals `#mobile-menu`.
   - At desktop width the link row is visible and the hamburger button is hidden.

## Out of Scope

- Stacked-card membership table
- Calendar-style event layout (tracked in `TODO.md`)
- Color/brand redesign
