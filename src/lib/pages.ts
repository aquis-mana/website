import { readItems } from '@directus/sdk'
import { getDirectusClient } from './directus'
import { createLogger } from './logger'

const log = createLogger('pages')

export interface CmsPage {
  slug: string
  title: string
  content: string
}

/** A published CMS page by slug, or null (also on error / Directus down). */
export async function getPageBySlug(slug: string): Promise<CmsPage | null> {
  try {
    const client = getDirectusClient()
    const items = await client.request(
      readItems('pages', {
        filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
        limit: 1,
      })
    )
    const page = items[0]
    if (!page) return null
    return { slug: page.slug, title: page.title, content: page.content }
  } catch (err) {
    log.error(`getPageBySlug(${slug}) failed`, err)
    return null
  }
}

/**
 * Published CMS pages for the navigation, ordered by slug. Returns an empty
 * array on error so the nav degrades to its static entries.
 */
export async function getNavPages(): Promise<Array<{ slug: string; title: string }>> {
  try {
    const client = getDirectusClient()
    const items = await client.request(
      readItems('pages', {
        filter: { status: { _eq: 'published' } },
        sort: ['slug'],
        fields: ['slug', 'title'],
      })
    )
    return items.map((p) => ({ slug: p.slug, title: p.title }))
  } catch (err) {
    log.error('getNavPages failed', err)
    return []
  }
}
