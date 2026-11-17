import { redirect } from 'next/navigation'
import { NotificationCenter } from '@/components/studio/notification-center'
import { requireOwner } from '@/lib/server-session'
import { listNotifications } from '@/server/notifications'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const session = await requireOwner()
  if (!session) redirect('/studio')
  const notifications = (await listNotifications()).map((item) => ({
    ...item,
    readAt: item.readAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }))
  return (
    <div className="studio-page max-w-[980px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Notifications</p>
          <h1>通知中心</h1>
          <p>邀请、授权和协作者发布事件集中显示在这里。</p>
        </div>
      </header>
      <NotificationCenter initialItems={notifications} />
    </div>
  )
}
