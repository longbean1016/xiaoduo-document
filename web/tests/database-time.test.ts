import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  parseDatabaseDateTime,
  toDatabaseDateTime,
} from '@/lib/database-time'
import { formatRelativeTime } from '@/lib/format-time'

describe('database time', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('writes Shanghai local time and parses it back as Shanghai time', () => {
    const instant = new Date('2026-11-16T01:30:00.123Z')

    expect(toDatabaseDateTime(instant)).toBe('2026-11-16 09:30:00.123')
    expect(
      parseDatabaseDateTime('2026-11-16 09:30:00.123').toISOString(),
    ).toBe('2026-11-16T01:30:00.123Z')
  })

  it('shows a just-saved Shanghai timestamp as just now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T01:30:00.000Z'))

    expect(formatRelativeTime('2026-11-16 09:29:30.000')).toBe('刚刚')
    expect(formatRelativeTime('2026-11-16 09:00:00.000')).toBe(
      '30 分钟前',
    )
  })
})
