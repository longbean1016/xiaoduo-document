import { cn } from '../lib/utils'

export function BrandMark({
  avatarUrl,
  compact = false,
  className,
}: {
  avatarUrl?: string
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'brand-mark flex items-center gap-3',
        compact && 'is-compact',
        className,
      )}
    >
      {avatarUrl ? (
        <span className="brand-mark-icon" aria-hidden="true">
          <img src={avatarUrl} alt="" draggable={false} />
        </span>
      ) : (
        <div className="brand-seal" aria-hidden="true">
          <span>知</span>
        </div>
      )}
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[23px] tracking-[0.16em] text-[var(--ink)]">
            知笺
          </div>
          <div className="mt-1 text-[12px] tracking-[0.3em] text-[var(--muted)] uppercase">
            Zhijian
          </div>
        </div>
      )}
    </div>
  )
}
