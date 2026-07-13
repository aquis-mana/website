import type { APIRoute } from 'astro'
import { updateRsvp, cancelRsvp, findActiveRsvp } from '../../../lib/rsvp'
import { createLogger } from '../../../lib/logger'
import { json, jsonError } from '../../../lib/http'

const log = createLogger('rsvp')

export const GET: APIRoute = async ({ params }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })

  try {
    const existing = await findActiveRsvp(token)
    if (!existing) return new Response(null, { status: 404 })
    return json({ status: existing.status })
  } catch (err) {
    log.error('GET by token failed', err)
    return jsonError('Server error', 500)
  }
}

export const PATCH: APIRoute = async ({ params, request }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { status } = body
  if (status !== 'yes' && status !== 'maybe') {
    return jsonError('Invalid status', 400)
  }

  try {
    const rsvp = await updateRsvp(token, status)
    return json(rsvp)
  } catch (err) {
    log.error('PATCH updateRsvp failed', err)
    return jsonError('RSVP not found', 404)
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  const { token } = params
  if (!token) return new Response(null, { status: 400 })
  try {
    await cancelRsvp(token)
  } catch (err) {
    log.error('DELETE cancelRsvp failed', err)
  }
  return new Response(null, { status: 204 })
}
