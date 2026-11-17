import { redirect } from 'next/navigation'
import { CollaborationManager } from '@/components/studio/collaboration-manager'
import { requireOwner } from '@/lib/server-session'
import {
  listAccessibleArticles,
  listArticleGrants,
} from '@/server/article-access'
import {
  listCollaborators,
  listInvites,
} from '@/server/collaboration'

export default async function CollaborationPage() {
  const session = await requireOwner()
  if (!session) redirect('/studio')
  const [articles, collaborators, grants] = await Promise.all([
    listAccessibleArticles({
      id: session.user.id,
      role: 'owner',
    }),
    listCollaborators(),
    listArticleGrants(),
  ])
  return (
    <CollaborationManager
      invites={await listInvites()}
      articles={articles}
      collaborators={collaborators}
      grants={grants}
    />
  )
}
