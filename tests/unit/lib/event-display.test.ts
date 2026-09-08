import { describe, it, expect } from 'vitest'
import { gameTag, displayTitle } from '../../../src/lib/event-display'

describe('gameTag', () => {
  it('reads the game from a "Prefix - ..." title', () => {
    expect(gameTag('MtG - Cube Draft')?.label).toBe('MtG')
    expect(gameTag('TCG - Open Play')?.label).toBe('TCG')
  })

  it('recognises an MtG format name anywhere in the title, no "MtG -" prefix required', () => {
    expect(gameTag('Öcher Series - MtG Pauper')?.label).toBe('MtG')
    expect(gameTag('Weekly Modern Night')?.label).toBe('MtG')
    expect(gameTag('Commander Open House')?.label).toBe('MtG')
  })

  it('tags anything mentioning Brettspiel as Brettspiele', () => {
    expect(gameTag('Brettspielabend')?.label).toBe('Brettspiele')
    expect(gameTag('offene Brettspielrunde')?.label).toBe('Brettspiele')
  })

  it('returns null when more than one game family matches (a combined event)', () => {
    expect(gameTag('Commander & TCG Open House + offene Brettspielrunde')).toBeNull()
  })

  it('returns null when no game family matches', () => {
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
