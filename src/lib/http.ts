/** JSON `Response` with the correct content type. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** JSON error `Response` of the shape `{ error: string }`. */
export function jsonError(message: string, status: number): Response {
  return json({ error: message }, status)
}
