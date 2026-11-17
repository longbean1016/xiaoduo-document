import { cn } from '@/lib/utils'

export function BrandMark({
  label = '小多笔记库',
  compact = false,
  className,
}: {
  label?: string
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'font-display text-[23px] font-semibold tracking-[0.08em] text-[var(--ink)]',
        compact && 'text-[18px] tracking-[0.04em]',
        className,
      )}
    >
      {label}
    </div>
  )
}
