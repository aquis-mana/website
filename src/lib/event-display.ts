export interface GameTag {
  label: string
  color: string
}

// Low-chroma hues, harmonised with the site's navy / blue-accent.
const GAMES = {
  mtg: { label: 'MtG', color: '#2f6fb3' },
  tcg: { label: 'TCG', color: '#1a8a76' },
  ygo: { label: 'YGO', color: '#7a4fc0' },
  brettspiel: { label: 'Brettspiele', color: '#b07d1e' },
} satisfies Record<string, GameTag>

// Keyword patterns that identify a game family anywhere in the title — not
// just a "Prefix - ..." shape, so "Öcher Series - MtG Pauper" (a format name,
// no "MtG -" prefix) still tags as MtG. A title matching more than one
// family (a combined event like "Commander & TCG Open House + offene
// Brettspielrunde") is left untagged rather than guessing which one leads.
const PATTERNS: [keyof typeof GAMES, RegExp][] = [
  ['mtg', /\b(mtg|modern|commander|cube|draft|pauper|standard|legacy|vintage|pioneer|limited|edh|sealed)\b/i],
  ['tcg', /\btcg\b/i],
  ['ygo', /\bygo\b|yu-?gi-?oh/i],
  ['brettspiel', /brettspiel/i],
]

/**
 * Derive a short game-type tag from an event title, or null when zero or
 * more than one game family's keywords match.
 */
export function gameTag(title: string): GameTag | null {
  const matches = PATTERNS.filter(([, pattern]) => pattern.test(title))
  return matches.length === 1 ? GAMES[matches[0][0]] : null
}

/** Swap the ASCII hyphen separator for a typographic en dash. */
export function displayTitle(title: string): string {
  return title.replace(/ - /g, ' – ')
}
