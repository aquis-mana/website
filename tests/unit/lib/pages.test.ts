import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/lib/directus', () => ({ getDirectusClient: vi.fn() }))

import { getDirectusClient } from '../../../src/lib/directus'
import { getPageBySlug, getNavPages } from '../../../src/lib/pages'

describe('pages lib', () => {
  let mockClient: { request: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockClient = { request: vi.fn() }
    vi.mocked(getDirectusClient).mockReturnValue(mockClient as never)
    // Silence the logger's error output during the error-path tests.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.restoreAllMocks())

  it('getPageBySlug returns the mapped published page', async () => {
    mockClient.request.mockResolvedValue([
      { slug: 'about-us', title: 'Über uns', content: '<p>hi</p>', status: 'published' },
    ])
    expect(await getPageBySlug('about-us')).toEqual({
      slug: 'about-us',
      title: 'Über uns',
      content: '<p>hi</p>',
    })
  })

  it('getPageBySlug returns null when no page matches', async () => {
    mockClient.request.mockResolvedValue([])
    expect(await getPageBySlug('nope')).toBeNull()
  })

  it('getPageBySlug returns null when Directus errors', async () => {
    mockClient.request.mockRejectedValue(new Error('down'))
    expect(await getPageBySlug('about-us')).toBeNull()
  })

  it('getNavPages returns the pages projected to slug + title', async () => {
    mockClient.request.mockResolvedValue([
      { slug: 'about-us', title: 'Über uns' },
      { slug: 'membership', title: 'Mitgliedschaft' },
    ])
    expect(await getNavPages()).toEqual([
      { slug: 'about-us', title: 'Über uns' },
      { slug: 'membership', title: 'Mitgliedschaft' },
    ])
  })

  it('getNavPages returns [] when Directus errors', async () => {
    mockClient.request.mockRejectedValue(new Error('down'))
    expect(await getNavPages()).toEqual([])
  })
})
