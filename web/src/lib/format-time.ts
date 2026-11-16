import {
  parseDatabaseDateTime,
  SHANGHAI_TIME_ZONE,
} from './database-time'

export function formatRelativeTime(iso: string): string {
  const timestamp = parseDatabaseDateTime(iso).getTime()
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    timeZone: SHANGHAI_TIME_ZONE,
  }).format(parseDatabaseDateTime(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: SHANGHAI_TIME_ZONE,
  }).format(parseDatabaseDateTime(iso))
}
