export interface GameTag {
  label: string
  color: string
}

// Low-chroma hues, harmonised with the site's navy / blue-accent.
const GAMES: Record<string, GameTag> = {
  mtg: { label: 'MtG', color: '#2f6fb3' },
  tcg: { label: 'TCG', color: '#1a8a76' },
  ygo: { label: 'YGO', color: '#7a4fc0' },
  brettspiel: { label: 'Brettspiel', color: '#b07d1e' },
}

// Exact titles (lower-cased) that don't follow the "Prefix - ..." shape.
const TITLE_OVERRIDES: Record<string, string> = {
  brettspielabend: 'brettspiel',
}

/**
 * Derive a short game-type tag from an event title. Recognises the
 * "MtG - ...", "TCG - ...", "YGO - ..." prefix shape (ASCII hyphen or en
 * dash) plus a few exact titles; returns null when nothing matches, e.g.
 * combined events like "Commander & TCG Open House + offene Brettspielrunde".
 */
export function gameTag(title: string): GameTag | null {
  const trimmed = title.trim()
  const prefix = trimmed.split(/\s[–-]\s/)[0].trim().toLowerCase()
  const key = TITLE_OVERRIDES[trimmed.toLowerCase()] ?? prefix
  return GAMES[key] ?? null
}

/** Swap the ASCII hyphen separator for a typographic en dash. */
export function displayTitle(title: string): string {
  return title.replace(/ - /g, ' – ')
}
