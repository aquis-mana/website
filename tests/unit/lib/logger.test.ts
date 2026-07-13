import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The threshold is read from LOG_LEVEL at module load, so each test sets the env
// and imports a fresh copy of the module via vi.resetModules().
async function loadLogger(level?: string) {
  vi.resetModules()
  if (level === undefined) delete process.env.LOG_LEVEL
  else process.env.LOG_LEVEL = level
  return import('../../../src/lib/logger')
}

describe('createLogger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.LOG_LEVEL
  })

  it('defaults to info: suppresses debug, emits info/warn/error', async () => {
    const { createLogger } = await loadLogger(undefined)
    const log = createLogger('test')

    log.debug('hidden')
    log.info('shown')
    log.warn('warned')
    log.error('boom')

    expect(logSpy).toHaveBeenCalledTimes(1) // info only (warn→console.warn)
    expect(logSpy).toHaveBeenCalledWith('[info] [test] shown')
    expect(warnSpy).toHaveBeenCalledWith('[warn] [test] warned')
    expect(errSpy).toHaveBeenCalledWith('[error] [test] boom')
  })

  it('LOG_LEVEL=debug emits debug', async () => {
    const { createLogger } = await loadLogger('debug')
    createLogger('test').debug('now visible')
    expect(logSpy).toHaveBeenCalledWith('[debug] [test] now visible')
  })

  it('LOG_LEVEL=error suppresses everything below error', async () => {
    const { createLogger } = await loadLogger('error')
    const log = createLogger('test')

    log.debug('x')
    log.info('x')
    log.warn('x')
    log.error('kept', { detail: 1 })

    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledWith('[error] [test] kept', { detail: 1 })
  })

  it('unknown LOG_LEVEL falls back to info', async () => {
    const { createLogger } = await loadLogger('bogus')
    const log = createLogger('test')
    log.debug('hidden')
    log.info('shown')
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('[info] [test] shown')
  })
})
