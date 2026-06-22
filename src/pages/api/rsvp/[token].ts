import type { APIRoute } from 'astro'
import { readItems } from '@directus/sdk'
import { getDirectusClient } from '../../../lib/directus'
import { updateRsvp, cancelRsvp } from '../../../lib/rsvp'

export const GET: APIRoute = async ({ params }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })

  try {
    const client = getDirectusClient()
    const items = await client.request(
      readItems('rsvps', {
        filter: { visitor_token: { _eq: token }, status: { _neq: 'cancelled' } },
        limit: 1,
        fields: ['status'],
      })
    )
    if (!items.length) return new Response(null, { status: 404 })
    const rsvp = items[0] as { status: 'yes' | 'maybe' }
    return new Response(JSON.stringify({ status: rsvp.status }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[rsvp] GET by token failed:', err)
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
  }
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { status } = body
  if (status !== 'yes' && status !== 'maybe') {
    return new Response(JSON.stringify({ error: 'Invalid status' }), { status: 400 })
  }

  try {
    const rsvp = await updateRsvp(token, status)
    return new Response(JSON.stringify(rsvp), { status: 200 })
  } catch (err) {
    console.error('[rsvp] PATCH updateRsvp failed:', err)
    return new Response(JSON.stringify({ error: 'RSVP not found' }), { status: 404 })
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })
  try {
    await cancelRsvp(token)
  } catch (err) {
    console.error('[rsvp] DELETE cancelRsvp failed:', err)
  }
  return new Response(null, { status: 204 })
}
