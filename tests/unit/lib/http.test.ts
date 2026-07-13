import { describe, expect, it } from 'vitest'
import { json, jsonError } from '../../../src/lib/http'

describe('http helpers', () => {
  it('json defaults to 200 and sets the JSON content type', async () => {
    const res = json({ ok: true })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('json honors an explicit status', () => {
    expect(json({ a: 1 }, 201).status).toBe(201)
  })

  it('jsonError wraps a message under `error` with the given status', async () => {
    const res = jsonError('Missing fields', 400)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Missing fields' })
  })
})
