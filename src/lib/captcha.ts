import { config } from './config'

export async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = config.turnstileSecretKey
  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    }
  )
  const data = await res.json()
  return data.success === true
}
