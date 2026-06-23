import { createDirectus, rest, staticToken } from '@directus/sdk'

interface DirectusSchema {
  events: {
    id: string
    title: string
    description: string
    date: string
    location: string
    image: string | null
    capacity: number | null
    capacity_warning_threshold: number | null
    status: 'published' | 'draft'
  }[]
  rsvps: {
    id: string
    event_id: string
    name: string
    status: 'yes' | 'maybe' | 'cancelled'
    visitor_token: string
    member_id: string | null
    date_created: string
    date_updated: string
  }[]
  pages: {
    id: string
    slug: string
    title: string
    content: string
    status: 'published' | 'draft'
  }[]
  documents: {
    id: string
    title: string
    file: string
    category: string
    sort: number
  }[]
}

let client: ReturnType<typeof createDirectus<DirectusSchema>> | null = null

export function getDirectusClient() {
  if (!client) {
    const url = import.meta.env.DIRECTUS_URL
    const token = import.meta.env.DIRECTUS_TOKEN ?? ''
    if (!url) {
      throw new Error('DIRECTUS_URL is not configured')
    }
    console.log(`[directus] connecting to ${url || '(no DIRECTUS_URL set)'}, token: ${token ? 'present' : 'MISSING'}`)
    client = createDirectus<DirectusSchema>(url)
      .with(staticToken(token))
      .with(rest())
  }
  return client
}
