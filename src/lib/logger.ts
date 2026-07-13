type Level = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 }

// LOG_LEVEL sets the minimum level that is emitted. Unknown/unset falls back to
// 'info', so per-request `debug` chatter stays out of production pod logs unless
// explicitly enabled (LOG_LEVEL=debug).
const threshold = ORDER[process.env.LOG_LEVEL as Level] ?? ORDER.info

function emit(level: Level, scope: string, msg: string, ...rest: unknown[]) {
  if (ORDER[level] < threshold) return
  const sink =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  sink(`[${level}] [${scope}] ${msg}`, ...rest)
}

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void
  info(msg: string, ...rest: unknown[]): void
  warn(msg: string, ...rest: unknown[]): void
  error(msg: string, ...rest: unknown[]): void
}

/** Create a logger that prefixes every line with `[level] [scope]`. */
export function createLogger(scope: string): Logger {
  return {
    debug: (msg, ...rest) => emit('debug', scope, msg, ...rest),
    info: (msg, ...rest) => emit('info', scope, msg, ...rest),
    warn: (msg, ...rest) => emit('warn', scope, msg, ...rest),
    error: (msg, ...rest) => emit('error', scope, msg, ...rest),
  }
}
