import Image from 'next/image'
import { cn } from '@/lib/utils'

export function AuthorAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
}: {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const classes = cn('author-avatar', `is-${size}`, className)
  if (avatarUrl) {
    return (
      <Image
        className={classes}
        src={avatarUrl}
        alt={`${name}的头像`}
        width={size === 'lg' ? 76 : size === 'md' ? 40 : 32}
        height={size === 'lg' ? 76 : size === 'md' ? 40 : 32}
        style={{ objectPosition: '50% 45%' }}
        unoptimized
      />
    )
  }
  return <span className={classes} aria-label={`${name}的头像`}>{name.trim().slice(0, 2)}</span>
}
