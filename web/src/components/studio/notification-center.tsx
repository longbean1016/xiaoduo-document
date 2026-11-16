'use client'

import {
  Check,
  ClipboardCheck,
  MailPlus,
  Send,
  UserRoundCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { parseDatabaseDateTime } from '@/lib/database-time'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string
  href: string | null
  readAt: string | null
  createdAt: string
}

const kindMeta: Record<
  string,
  { label: string; icon: typeof ClipboardCheck }
> = {
  application: { label: '协作申请', icon: ClipboardCheck },
  invitation: { label: '协作邀请', icon: MailPlus },
  grant: { label: '文章授权', icon: UserRoundCheck },
  publish: { label: '协作者发布', icon: Send },
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(parseDatabaseDateTime(value))
}

export function NotificationCenter({
  initialItems,
}: {
  initialItems: NotificationItem[]
}) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [message, setMessage] = useState('')
  const unreadCount = items.filter((item) => !item.readAt).length

  async function markRead(id: string) {
    const response = await fetch(`/api/studio/notifications/${id}/read`, {
      method: 'POST',
    })
    if (!response.ok) {
      setMessage('标记已读失败')
      return
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    )
    setMessage('已读')
    router.refresh()
  }

  async function markAllRead() {
    const response = await fetch('/api/studio/notifications/read-all', {
      method: 'POST',
    })
    if (!response.ok) {
      setMessage('全部标记失败')
      return
    }
    const readAt = new Date().toISOString()
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
    )
    setMessage('全部已读')
    router.refresh()
  }

  return (
    <div className="notification-center">
      <div className="notification-toolbar">
        <span className="notification-unread-count">
          {unreadCount} 条未读
        </span>
        <button
          type="button"
          className="studio-secondary-button"
          onClick={() => void markAllRead()}
          disabled={!unreadCount}
        >
          全部标记已读
        </button>
      </div>

      {message ? (
        <p className="notification-feedback" role="status">
          {message}
        </p>
      ) : null}

      <ol aria-label="通知列表">
        {items.map((item) => {
          const meta = kindMeta[item.kind] ?? {
            label: item.kind,
            icon: ClipboardCheck,
          }
          const Icon = meta.icon
          return (
            <li
              key={item.id}
              className={cn(
                'notification-row',
                item.readAt ? 'is-read' : 'is-unread',
              )}
            >
              <span className="notification-kind-icon">
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p>{meta.label}</p>
                  {!item.readAt ? (
                    <span className="notification-unread-dot" />
                  ) : null}
                </div>
                <h2>{item.title}</h2>
                <span>{item.body}</span>
                <time dateTime={item.createdAt}>
                  {formatTime(item.createdAt)}
                </time>
              </div>
              <div className="notification-actions">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="studio-secondary-button"
                  >
                    查看
                  </Link>
                ) : null}
                {!item.readAt ? (
                  <button
                    type="button"
                    className="studio-icon-button"
                    aria-label={`标记已读 ${item.title}`}
                    title="标记已读"
                    onClick={() => void markRead(item.id)}
                  >
                    <Check size={19} />
                  </button>
                ) : (
                  <span className="notification-read-label">已读</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {!items.length ? (
        <div className="notification-empty">
          <MailPlus size={26} />
          <p>暂无通知</p>
          <span>协作申请、邀请、授权和发布事件会出现在这里。</span>
        </div>
      ) : null}
    </div>
  )
}
