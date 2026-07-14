# Dynamic CMS Pages & Navigation — Design

Date: 2026-07-14

## Goal

Render all pages except the main page (`/`) and Documents (`/documents`) from the
Directus `pages` collection via one generic route, and build the site navigation
dynamically from those CMS pages.

## Scope

- Main page (`index.astro`) and Documents (`documents.astro`) stay code-rendered.
- About and Membership become CMS pages served by a generic `[slug]` route
  (their bespoke `.astro` files are removed).
- Membership's hardcoded fee table / bank details / auto Antrag-download are
  dropped; that content is authored in Directus (manual `/cms-assets` link).

## Data model

No schema change. The `pages` collection stays `id, slug, title, content,
status`. Nav ordering is by `slug` (alphabetical) for now; a `sort` field can be
added later. All published pages appear in the nav.

## Components

### `src/lib/pages.ts` (new)
- `getPageBySlug(slug: string): Promise<{ slug, title, content } | null>` —
  published page by slug, or null.
- `getNavPages(): Promise<Array<{ slug, title }>>` — published pages ordered by
  slug; returns `[]` on error so the nav degrades gracefully.

### `src/pages/[slug].astro` (new)
Uses `getPageBySlug(Astro.params.slug)`. If null → `Astro.response.status = 404`
and render a minimal not-found message. Otherwise render `page.title` as `<h1>`
and `sanitizeCmsHtml(page.content)` inside a `.cms-content` container. Static
routes (`index`, `documents`, `api`, `cms-assets`, `healthz`) take precedence.

### `src/layouts/Base.astro` (modify)
Build nav each request: **Home** (`/`) → **published CMS pages** (`/<slug>`,
label = `title`, ordered by slug) → **Documents** (`/documents`). Uses
`getNavPages()`; on failure nav is just Home + Documents. Applied to both the
desktop and mobile menus.

### `src/styles/global.css` (modify)
Add `.cms-content` styles (headings, paragraphs, lists, links, tables) so CMS
pages are readable (the `prose` class is currently inert — no typography
plugin). Tables scroll horizontally on mobile (`overflow-x`) to preserve the
Membership fee table's responsiveness.

## Removed / migrated

- Delete `src/pages/about-us.astro` and `src/pages/membership.astro`.
- Directus content (author-side): About page `slug=about-us title=Über uns`;
  Membership page `slug=membership title=Mitgliedschaft` with content = the
  provided HTML (fee table, IBAN, Antrag link). Titles now drive both the `<h1>`
  and the nav label.
- Unused i18n keys (`about.heading`, `membership.*`) are left in place (harmless).

## Error handling

Directus down → `getPageBySlug` returns null (page 404s with fallback text),
`getNavPages` returns `[]` (nav shows Home + Documents). Matches the existing
try/catch-with-fallback pattern.

## Testing

- Unit (`tests/unit/lib/pages.test.ts`): `getPageBySlug` returns mapped page /
  null; `getNavPages` returns ordered list / `[]` on error. Mock
  `getDirectusClient` like the existing adapter tests.
- Build + `astro check` + full vitest suite green.
- e2e (`responsive.spec.ts`) `/membership` overflow check stays; it is
  backend-dependent (as the suite already is).

## Out of scope

Nav `sort` field, `show_in_nav` flag, hierarchical/dropdown nav, and auto
download-card styling for `/cms-assets` links (can be added later).
