import type { APIRoute } from 'astro'
import { createRsvp } from '../../../lib/rsvp'
import { verifyTurnstile } from '../../../lib/captcha'
import { createLogger } from '../../../lib/logger'
import { json, jsonError } from '../../../lib/http'

const log = createLogger('rsvp')

export const POST: APIRoute = async ({ request }) => {
  let body: { eventId?: string; name?: string; status?: string; visitorToken?: string; captchaToken?: string }
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  const { eventId, name, status, visitorToken, captchaToken } = body

  if (!eventId || !name?.trim() || !status || !visitorToken || !captchaToken) {
    return jsonError('Missing fields', 400)
  }
  if (status !== 'yes' && status !== 'maybe') {
    return jsonError('Invalid status', 400)
  }

  const captchaOk = await verifyTurnstile(captchaToken)
  if (!captchaOk) {
    return jsonError('CAPTCHA failed', 422)
  }

  try {
    const rsvp = await createRsvp(eventId, name.trim(), status, visitorToken)
    return json(rsvp, 201)
  } catch (err) {
    log.error('POST createRsvp failed', err)
    return jsonError('Server error', 500)
  }
}
