import { redirect } from 'next/navigation'
import { StudioShell } from '@/components/studio/studio-shell'
import { getPublicSiteProfile } from '@/lib/public-library'
import { getServerSession } from '@/lib/server-session'
import {
  listAccessibleCategories,
  studioActorFromUser,
} from '@/server/article-access'

export default async function ProtectedStudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession()
  if (!session || session.user.status !== 'active') {
    redirect('/studio/login')
  }
  const actor = studioActorFromUser(session.user)
  const [profile, categories] = await Promise.all([
    getPublicSiteProfile(),
    listAccessibleCategories(actor),
  ])
  const isOwner = session.user.role === 'owner'

  return (
    <StudioShell
      role={isOwner ? 'owner' : 'collaborator'}
      currentName={
        isOwner
          ? (profile?.authorName ?? session.user.name)
          : session.user.name
      }
      avatarUrl={isOwner ? profile?.avatarUrl : session.user.image}
      brandAvatarUrl={profile?.avatarUrl}
      categories={categories}
    >
      {children}
    </StudioShell>
  )
}
