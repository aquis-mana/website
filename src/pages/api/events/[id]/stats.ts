import type { APIRoute } from 'astro'
import { getRsvpStats } from '../../../../lib/rsvp'
import { getAdapter } from '../../../../adapters/calendar'
import { createLogger } from '../../../../lib/logger'

const log = createLogger('events')

export const GET: APIRoute = async ({ params }) => {
  const { id } = params
  if (!id) return new Response(null, { status: 400 })

  try {
    const adapter = await getAdapter()
    const event = await adapter.getEvent(id)
    const stats = await getRsvpStats(
      id,
      event?.capacity ?? null,
      event?.capacityWarningThreshold ?? null
    )
    return new Response(JSON.stringify(stats), { status: 200 })
  } catch (err) {
    log.error(`GET stats for ${id} failed`, err)
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
  }
}
