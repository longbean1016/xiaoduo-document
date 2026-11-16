export const SHANGHAI_TIME_ZONE = 'Asia/Shanghai'
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const NAIVE_DATETIME =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/

export function toDatabaseDateTime(date = new Date()): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS)
    .toISOString()
    .slice(0, 23)
    .replace('T', ' ')
}

export function parseDatabaseDateTime(value: string): Date {
  const normalized = value.trim()
  if (NAIVE_DATETIME.test(normalized)) {
    return new Date(`${normalized.replace(' ', 'T')}+08:00`)
  }
  return new Date(normalized)
}
