import { describe, it, expect } from 'vitest'
import { gameTag, displayTitle } from '../../../src/lib/event-display'

describe('gameTag', () => {
  it('reads the game from a "Prefix - ..." title', () => {
    expect(gameTag('MtG - Cube Draft')?.label).toBe('MtG')
    expect(gameTag('TCG - Open Play')?.label).toBe('TCG')
  })

  it('handles the en dash separator as well as the ASCII hyphen', () => {
    expect(gameTag('MtG – Pauper Liga')?.label).toBe('MtG')
  })

  it('special-cases the exact title "Brettspielabend"', () => {
    expect(gameTag('Brettspielabend')?.label).toBe('Brettspiel')
  })

  it('returns null for combined or unrecognised titles', () => {
    expect(gameTag('Commander & TCG Open House + offene Brettspielrunde')).toBeNull()
    expect(gameTag('Mitgliederversammlung')).toBeNull()
  })

  it('carries a colour with the label', () => {
    expect(gameTag('YGO - Genesys')).toEqual({ label: 'YGO', color: expect.stringMatching(/^#/) })
  })
})

describe('displayTitle', () => {
  it('swaps the " - " separator for an en dash', () => {
    expect(displayTitle('MtG - Cube Draft')).toBe('MtG – Cube Draft')
  })

  it('leaves titles without the separator untouched', () => {
    expect(displayTitle('Brettspielabend')).toBe('Brettspielabend')
  })
})
