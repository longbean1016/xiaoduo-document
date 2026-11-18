import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrandMark({
  label = '小多笔记',
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
        'brand-mark',
        compact && 'is-compact',
        className,
      )}
    >
      <span className="brand-mark-icon" aria-hidden="true">
        <Image
          src="/xiaoduo-brand.webp"
          alt=""
          width={512}
          height={512}
          sizes="96px"
          unoptimized
          draggable={false}
        />
      </span>
      <span
        className={cn(
          'brand-mark-label font-display text-[23px] font-semibold tracking-[0.08em] text-[var(--ink)]',
          compact && 'text-[18px] tracking-[0.04em]',
        )}
      >
        {label}
      </span>
    </div>
  )
}
