import { cn, initials } from '../lib/utils'

export function AuthorAvatar({
  name,
  avatarUrl,
  size = 'md',
  className,
}: {
  name: string
  avatarUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      className={cn('author-avatar', `is-${size}`, className)}
      aria-label={`${name}的头像`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" style={{ objectPosition: '50% 45%' }} />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  )
}
