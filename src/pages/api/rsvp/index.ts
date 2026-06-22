import type { APIRoute } from 'astro'
import { createRsvp } from '../../../lib/rsvp'
import { verifyTurnstile } from '../../../lib/captcha'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const POST: APIRoute = async ({ request }) => {
  let body: { eventId?: string; name?: string; status?: string; visitorToken?: string; captchaToken?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { eventId, name, status, visitorToken, captchaToken } = body

  if (!eventId || !name?.trim() || !status || !visitorToken || !captchaToken) {
    return json({ error: 'Missing fields' }, 400)
  }
  if (status !== 'yes' && status !== 'maybe') {
    return json({ error: 'Invalid status' }, 400)
  }

  const captchaOk = await verifyTurnstile(captchaToken)
  if (!captchaOk) {
    return json({ error: 'CAPTCHA failed' }, 422)
  }

  try {
    const rsvp = await createRsvp(eventId, name.trim(), status, visitorToken)
    return json(rsvp, 201)
  } catch (err) {
    console.error('[rsvp] POST createRsvp failed:', err)
    return json({ error: 'Server error' }, 500)
  }
}
