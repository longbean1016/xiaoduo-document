import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  account,
  article,
  collaborationApplication,
  collaborationInvite,
  collaborationInviteArticle,
  collaborationPasswordReset,
  session,
  user,
} from '@/db/schema'
import { createNotification } from '@/server/notifications'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface ApplicationRecord {
  id: string
  articleId: string
  articleTitle: string
  name: string
  email: string
  note: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

export interface InviteRecord {
  id: string
  email: string | null
  displayName: string | null
  articleIds: string[]
  source: 'application' | 'direct'
  status: 'pending' | 'activated' | 'expired' | 'revoked'
  expiresAt: Date
  createdAt: Date
  token?: string
}

export interface InvitationActivationPreview {
  email: string | null
  displayName: string | null
  articleTitles: string[]
  status: 'pending' | 'activated' | 'expired' | 'revoked'
  expiresAt: Date
}

export interface CollaboratorRecord {
  id: string
  name: string
  email: string
  status: 'active' | 'suspended'
}

export interface PasswordResetPreview {
  email: string
  status: 'pending' | 'used' | 'expired'
  expiresAt: Date
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function notifyInvitation(
  invite: typeof collaborationInvite.$inferSelect,
  status: 'pending' | 'activated' | 'expired' | 'revoked',
) {
  const labels = {
    pending: '邀请已生成',
    activated: '邀请已激活',
    expired: '邀请已过期',
    revoked: '邀请已撤销',
  }
  await createNotification({
    eventKey: `invitation:${status}:${invite.id}`,
    kind: 'invitation',
    title: labels[status],
    body: `${invite.email ?? '未绑定邮箱'} 的协作邀请状态变为 ${status}`,
    href: '/studio/collaboration',
  })
}

async function inviteArticleIds(inviteId: string) {
  const rows = await db
    .select({ articleId: collaborationInviteArticle.articleId })
    .from(collaborationInviteArticle)
    .where(eq(collaborationInviteArticle.inviteId, inviteId))
  return rows.map((row) => row.articleId)
}

export async function submitApplication(input: {
  articleId: string
  name: string
  email: string
  note: string
}): Promise<ApplicationRecord | 'duplicate'> {
  const email = normalizeEmail(input.email)
  const [target] = await db
    .select({ id: article.id })
    .from(article)
    .where(
      and(
        eq(article.id, input.articleId),
        eq(article.publicationState, 'published'),
        isNull(article.trashedAt),
      ),
    )
    .limit(1)
  if (!target) throw new Error('ARTICLE_NOT_FOUND')

  const existing = await db
    .select({ id: collaborationApplication.id })
    .from(collaborationApplication)
    .where(
      and(
        eq(collaborationApplication.articleId, input.articleId),
        eq(collaborationApplication.email, email),
        eq(collaborationApplication.status, 'pending'),
      ),
    )
    .limit(1)
  if (existing.length) return 'duplicate'

  const id = crypto.randomUUID()
  await db.insert(collaborationApplication).values({
    id,
    articleId: input.articleId,
    name: input.name.trim(),
    email,
    note: input.note.trim(),
    status: 'pending',
  })
  await createNotification({
    eventKey: `application:created:${id}`,
    kind: 'application',
    title: '新的协作申请',
    body: `${input.name.trim()} 申请参与《${(await db
      .select({ title: article.title })
      .from(article)
      .where(eq(article.id, input.articleId))
      .limit(1))[0]?.title ?? '章节'}》`,
    href: '/studio/collaboration',
  })
  const application = (await listApplications()).find((item) => item.id === id)
  if (!application) throw new Error('APPLICATION_CREATE_FAILED')
  return application
}

export async function listApplications(): Promise<ApplicationRecord[]> {
  return db
    .select({
      id: collaborationApplication.id,
      articleId: collaborationApplication.articleId,
      articleTitle: article.title,
      name: collaborationApplication.name,
      email: collaborationApplication.email,
      note: collaborationApplication.note,
      status: collaborationApplication.status,
      createdAt: collaborationApplication.createdAt,
    })
    .from(collaborationApplication)
    .innerJoin(article, eq(collaborationApplication.articleId, article.id))
    .orderBy(desc(collaborationApplication.createdAt))
}

async function createInvite(input: {
  email: string | null
  displayName?: string | null
  articleIds: string[]
  source: 'application' | 'direct'
  applicationId?: string | null
}): Promise<InviteRecord> {
  const articleIds = [...new Set(input.articleIds)]
  const email = input.email ? normalizeEmail(input.email) : null
  if (!articleIds.length) throw new Error('NO_ARTICLES')
  const valid = await db
    .select({ id: article.id })
    .from(article)
    .where(and(inArray(article.id, articleIds), isNull(article.trashedAt)))
  if (valid.length !== articleIds.length) throw new Error('ARTICLE_NOT_FOUND')

  const token = randomBytes(32).toString('hex')
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)
  await db.transaction(async (transaction) => {
    await transaction.insert(collaborationInvite).values({
      id,
      tokenHash: hashToken(token),
      email,
      displayName: input.displayName?.trim() || null,
      claimedUserId: null,
      claimedAt: null,
      source: input.source,
      applicationId: input.applicationId ?? null,
      status: 'pending',
      expiresAt,
    })
    for (const articleId of articleIds) {
      await transaction.insert(collaborationInviteArticle).values({
        inviteId: id,
        articleId,
      })
    }
  })
  await notifyInvitation(
    {
      id,
      tokenHash: hashToken(token),
      email,
      displayName: input.displayName?.trim() || null,
      claimedUserId: null,
      claimedAt: null,
      source: input.source,
      applicationId: input.applicationId ?? null,
      status: 'pending',
      expiresAt,
      createdAt: new Date(),
    },
    'pending',
  )
  return {
    id,
    email,
    displayName: input.displayName?.trim() || null,
    articleIds,
    source: input.source,
    status: 'pending',
    expiresAt,
    createdAt: new Date(),
    token,
  }
}

export async function createDirectInvite(input: {
  articleIds: string[]
  /** Legacy migration compatibility; new links intentionally start unbound. */
  email?: string
  displayName?: string
}) {
  return createInvite({
    articleIds: input.articleIds,
    displayName: input.displayName,
    email: input.email ?? null,
    source: 'direct',
  })
}

export async function revokePendingInvite(id: string) {
  const [invite] = await db
    .select()
    .from(collaborationInvite)
    .where(eq(collaborationInvite.id, id))
    .limit(1)

  if (!invite) return 'not-found' as const
  if (invite.status !== 'pending') return 'not-pending' as const

  const [result] = await db
    .update(collaborationInvite)
    .set({ status: 'revoked' })
    .where(
      and(
        eq(collaborationInvite.id, id),
        eq(collaborationInvite.status, 'pending'),
      ),
    )
  if (!result.affectedRows) return 'not-pending' as const

  await notifyInvitation(invite, 'revoked')
  return 'revoked' as const
}

export async function approveApplication(
  applicationId: string,
): Promise<InviteRecord | null> {
  const [application] = await db
    .select()
    .from(collaborationApplication)
    .where(eq(collaborationApplication.id, applicationId))
    .limit(1)
  if (!application || application.status !== 'pending') return null

  const invite = await createInvite({
    email: application.email,
    displayName: application.name,
    articleIds: [application.articleId],
    source: 'application',
    applicationId: application.id,
  })
  await db
    .update(collaborationApplication)
    .set({ status: 'approved', reviewedAt: new Date() })
    .where(eq(collaborationApplication.id, applicationId))
  return invite
}

export async function rejectApplication(applicationId: string) {
  const [application] = await db
    .select({ id: collaborationApplication.id })
    .from(collaborationApplication)
    .where(
      and(
        eq(collaborationApplication.id, applicationId),
        eq(collaborationApplication.status, 'pending'),
      ),
    )
    .limit(1)
  if (!application) return false
  await db
    .update(collaborationApplication)
    .set({ status: 'rejected', reviewedAt: new Date() })
    .where(eq(collaborationApplication.id, applicationId))
  return true
}

export async function listInvites(): Promise<InviteRecord[]> {
  const invites = await db
    .select()
    .from(collaborationInvite)
    .orderBy(desc(collaborationInvite.createdAt))
  return Promise.all(
    invites.map(async (invite) => ({
      id: invite.id,
      email: invite.email,
      displayName: invite.displayName,
      articleIds: await inviteArticleIds(invite.id),
      source: invite.source,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    })),
  )
}

export async function getInvitationActivationPreview(
  token: string,
): Promise<InvitationActivationPreview | null> {
  const [invite] = await db
    .select()
    .from(collaborationInvite)
    .where(eq(collaborationInvite.tokenHash, hashToken(token)))
    .limit(1)
  if (!invite) return null

  let status = invite.status
  if (status === 'pending' && invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(collaborationInvite)
      .set({ status: 'expired' })
      .where(eq(collaborationInvite.id, invite.id))
    status = 'expired'
    await notifyInvitation(invite, 'expired')
  }
  const articles = await db
    .select({ title: article.title })
    .from(collaborationInviteArticle)
    .innerJoin(
      article,
      eq(collaborationInviteArticle.articleId, article.id),
    )
    .where(eq(collaborationInviteArticle.inviteId, invite.id))
    .orderBy(article.position)

  return {
    email: invite.email,
    displayName: invite.displayName,
    articleTitles: articles.map((item) => item.title),
    status,
    expiresAt: invite.expiresAt,
  }
}

export async function setCollaboratorStatus(
  userId: string,
  status: 'active' | 'suspended',
): Promise<boolean> {
  const result = await db
    .update(user)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(user.id, userId), eq(user.role, 'collaborator')),
    )
  if (result[0].affectedRows === 0) return false
  if (status === 'suspended') {
    await db.delete(session).where(eq(session.userId, userId))
  }
  return true
}

export async function listCollaborators(): Promise<CollaboratorRecord[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    })
    .from(user)
    .where(eq(user.role, 'collaborator'))
    .orderBy(user.name, user.email)
}

export async function createCollaboratorPasswordReset(userId: string) {
  const [collaborator] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(
      and(eq(user.id, userId), eq(user.role, 'collaborator')),
    )
    .limit(1)
  if (!collaborator) throw new Error('COLLABORATOR_NOT_FOUND')

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  await db.insert(collaborationPasswordReset).values({
    id: randomUUID(),
    userId: collaborator.id,
    email: collaborator.email,
    tokenHash: hashToken(token),
    status: 'pending',
    expiresAt,
  })
  return {
    token,
    email: collaborator.email,
    expiresAt,
  }
}

export async function getPasswordResetPreview(
  token: string,
): Promise<PasswordResetPreview | null> {
  const [reset] = await db
    .select()
    .from(collaborationPasswordReset)
    .where(
      eq(collaborationPasswordReset.tokenHash, hashToken(token)),
    )
    .limit(1)
  if (!reset) return null
  let status = reset.status
  if (status === 'pending' && reset.expiresAt.getTime() <= Date.now()) {
    await db
      .update(collaborationPasswordReset)
      .set({ status: 'expired' })
      .where(eq(collaborationPasswordReset.id, reset.id))
    status = 'expired'
  }
  return {
    email: reset.email,
    status,
    expiresAt: reset.expiresAt,
  }
}

export async function resetCollaboratorPassword(
  token: string,
  password: string,
): Promise<'reset' | 'used' | 'expired' | 'invalid'> {
  const passwordHash = await hashPassword(password)
  return db.transaction(async (transaction) => {
    const [reset] = await transaction
      .select()
      .from(collaborationPasswordReset)
      .where(
        eq(collaborationPasswordReset.tokenHash, hashToken(token)),
      )
      .for('update')
      .limit(1)
    if (!reset) return 'invalid'
    if (reset.status === 'used') return 'used'
    if (
      reset.status === 'expired' ||
      reset.expiresAt.getTime() <= Date.now()
    ) {
      if (reset.status !== 'expired') {
        await transaction
          .update(collaborationPasswordReset)
          .set({ status: 'expired' })
          .where(eq(collaborationPasswordReset.id, reset.id))
      }
      return 'expired'
    }

    const [collaborator] = await transaction
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, reset.userId))
      .limit(1)
    if (!collaborator || collaborator.email !== reset.email) return 'invalid'

    const [credentialAccount] = await transaction
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, collaborator.id),
          eq(account.providerId, 'credential'),
        ),
      )
      .limit(1)
    if (!credentialAccount) return 'invalid'

    await transaction
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, credentialAccount.id))
    await transaction
      .update(collaborationPasswordReset)
      .set({ status: 'used', usedAt: new Date() })
      .where(eq(collaborationPasswordReset.id, reset.id))
    await transaction
      .delete(session)
      .where(eq(session.userId, collaborator.id))
    return 'reset'
  })
}
