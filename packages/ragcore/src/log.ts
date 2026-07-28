import { pino } from 'pino'

const RING_CAP = 300
const ring: string[] = []
const sink = {
  write: (line: string): void => {
    ring.push(line.trimEnd())
    if (ring.length > RING_CAP) ring.shift()
    process.stdout.write(line)
  }
}
const log = pino(
  {
    name: 'app',
    redact: {
      censor: '[redacted]',
      paths: [
        'password',
        'token',
        'secret',
        'apiKey',
        'authorization',
        '*.password',
        '*.token',
        '*.secret',
        '*.apiKey',
        '*.authorization',
        'requestBodyValues',
        '*.requestBodyValues',
        'responseBody',
        '*.responseBody',
        'responseHeaders',
        '*.responseHeaders',
        'req.headers.authorization',
        'req.headers.cookie'
      ]
    }
  },
  sink
)
const recentLogs = (limit = 200): unknown[] =>
  ring.slice(Math.max(0, ring.length - limit)).map(line => {
    try {
      return JSON.parse(line) as unknown
    } catch {
      return { raw: line }
    }
  })
export { log, recentLogs }
