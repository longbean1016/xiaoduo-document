import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ProfileForm } from '@/components/studio/profile-form'
import { db } from '@/db/client'
import { siteProfile } from '@/db/schema'
import { requireStudioSession } from '@/lib/server-session'

export default async function StudioSettingsPage() {
  const session = await requireStudioSession()
  if (!session) redirect('/studio')

  if (session.user.role !== 'owner') {
    return (
      <ProfileForm
        mode="collaborator"
        initial={{
          authorName: session.user.name,
          avatarUrl: session.user.image ?? '',
          roleTitle: '协作者',
          intro: '',
          nowText: '',
          location: '',
          email: session.user.email,
        }}
      />
    )
  }

  const [profile] = await db
    .select()
    .from(siteProfile)
    .where(eq(siteProfile.id, 'primary'))
    .limit(1)

  if (!profile) notFound()

  return (
    <ProfileForm
      mode="owner"
      initial={{
        authorName: profile.authorName,
        avatarUrl: profile.avatarUrl ?? '',
        roleTitle: profile.roleTitle,
        intro: profile.intro,
        nowText: profile.nowText,
        location: profile.location,
        email: profile.email,
      }}
    />
  )
}
