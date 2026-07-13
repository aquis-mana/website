import { type DirectusClient, type RestClient, type StaticTokenClient, createDirectus, rest, staticToken } from '@directus/sdk'
import { config } from './config'

interface DirectusSchema {
  events: {
    id: string
    title: string
    description: string
    date: 'datetime'
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

type DirectusRestClient = DirectusClient<DirectusSchema> & StaticTokenClient<DirectusSchema> & RestClient<DirectusSchema>

let client: DirectusRestClient | null = null

export function getDirectusClient(): DirectusRestClient {
  if (!client) {
    const url = config.directusUrl
    const token = config.directusToken
    if (!url) {
      throw new Error('DIRECTUS_URL is not configured')
    }
    client = createDirectus<DirectusSchema>(url)
      .with(staticToken(token))
      .with(rest()) as DirectusRestClient
  }
  return client
}
