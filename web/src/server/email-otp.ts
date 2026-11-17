import { createHash, randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db/client'
import {
  articleGrant,
  collaborationInvite,
  collaborationInviteArticle,
  emailOtpRequest,
  user,
} from '@/db/schema'
import { normalizeEmail } from '@/server/collaboration'

export const OTP_EXPIRES_IN_SECONDS = 600
export const OTP_RESEND_COOLDOWN_SECONDS = 60
export const OTP_MAX_PER_HOUR = 5
export const OTP_MAX_PER_DAY = 10
export const OTP_MAX_PER_IP_HOUR = 10

export type OtpPurpose =
  | 'invite_activation'
  | 'collaborator_login'
  | 'owner_recovery'

export interface OtpEmailSender {
  sendOtp(input: {
    email: string
    code: string
    expiresInSeconds: number
    purpose: OtpPurpose
  }): Promise<void>
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function otpRequestCount(input: {
  email?: string
  ip?: string
  windowSeconds: number
}) {
  const conditions = [
    sql`${emailOtpRequest.requestedAt} > DATE_SUB(NOW(3), INTERVAL ${sql.raw(
      String(input.windowSeconds),
    )} SECOND)`,
  ]
  if (input.email) {
    conditions.push(eq(emailOtpRequest.email, input.email))
  }
  if (input.ip) {
    conditions.push(eq(emailOtpRequest.ipAddress, input.ip))
  }
  const rows = await db
    .select({ id: emailOtpRequest.id })
    .from(emailOtpRequest)
    .where(and(...conditions))
  return rows.length
}

async function assertOtpRateLimit(email: string, ip: string) {
  if (
    (await otpRequestCount({
      email,
      windowSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    })) > 0
  ) {
    throw new Error('OTP_COOLDOWN')
  }
  if (
    (await otpRequestCount({
      email,
      windowSeconds: 60 * 60,
    })) >= OTP_MAX_PER_HOUR
  ) {
    throw new Error('OTP_EMAIL_HOURLY_LIMIT')
  }
  if (
    (await otpRequestCount({
      email,
      windowSeconds: 24 * 60 * 60,
    })) >= OTP_MAX_PER_DAY
  ) {
    throw new Error('OTP_EMAIL_DAILY_LIMIT')
  }
  if (
    (await otpRequestCount({
      ip,
      windowSeconds: 60 * 60,
    })) >= OTP_MAX_PER_IP_HOUR
  ) {
    throw new Error('OTP_IP_HOURLY_LIMIT')
  }
}

async function createAndSendOtp(input: {
  email: string
  ip: string
  mailer: OtpEmailSender
  purpose: OtpPurpose
}) {
  await assertOtpRateLimit(input.email, input.ip)
  const otp = await auth.api.createVerificationOTP({
    body: { email: input.email, type: 'sign-in' },
  })
  await db.insert(emailOtpRequest).values({
    id: randomUUID(),
    email: input.email,
    purpose: input.purpose,
    ipAddress: input.ip,
  })
  await input.mailer.sendOtp({
    code: String(otp),
    email: input.email,
    expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
    purpose: input.purpose,
  })
}

async function pendingInvite(token: string) {
  const [invite] = await db
    .select()
    .from(collaborationInvite)
    .where(eq(collaborationInvite.tokenHash, hashToken(token)))
    .limit(1)
  if (!invite) throw new Error('INVITE_NOT_FOUND')
  if (invite.status !== 'pending') throw new Error('INVITE_NOT_PENDING')
  if (invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(collaborationInvite)
      .set({ status: 'expired' })
      .where(eq(collaborationInvite.id, invite.id))
    throw new Error('INVITE_EXPIRED')
  }
  return invite
}

async function assertEligibleCollaboratorEmail(email: string) {
  const [existing] = await db
    .select({ id: user.id, role: user.role, status: user.status })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  if (existing?.role === 'owner') throw new Error('OWNER_ACCOUNT')
  if (existing?.status === 'suspended') throw new Error('ACCOUNT_SUSPENDED')
  return existing ?? null
}

export async function requestInviteOtp(input: {
  token: string
  email: string
  ip: string
  mailer: OtpEmailSender
}) {
  await pendingInvite(input.token)
  const email = normalizeEmail(input.email)
  await assertEligibleCollaboratorEmail(email)
  await createAndSendOtp({
    email,
    ip: input.ip,
    mailer: input.mailer,
    purpose: 'invite_activation',
  })
}

export async function activateInvitationWithOtp(input: {
  token: string
  email: string
  name: string
  otp: string
}) {
  await pendingInvite(input.token)
  const email = normalizeEmail(input.email)
  const existing = await assertEligibleCollaboratorEmail(email)
  const temporaryUserId = existing ? null : randomUUID()
  if (temporaryUserId) {
    await db.insert(user).values({
      id: temporaryUserId,
      email,
      emailVerified: true,
      name: input.name.trim(),
      role: 'collaborator',
      status: 'suspended',
    })
  }

  try {
    await auth.api.checkVerificationOTP({
      body: { email, otp: input.otp, type: 'sign-in' },
    })
  } catch (error) {
    if (temporaryUserId) {
      await db.delete(user).where(eq(user.id, temporaryUserId))
    }
    throw error
  }

  try {
    return await db.transaction(async (transaction) => {
    const [invite] = await transaction
      .select()
      .from(collaborationInvite)
      .where(eq(collaborationInvite.tokenHash, hashToken(input.token)))
      .for('update')
      .limit(1)
    if (!invite || invite.status !== 'pending') {
      throw new Error('INVITE_NOT_PENDING')
    }
    if (invite.expiresAt.getTime() <= Date.now()) {
      await transaction
        .update(collaborationInvite)
        .set({ status: 'expired' })
        .where(eq(collaborationInvite.id, invite.id))
      throw new Error('INVITE_EXPIRED')
    }

    const [existingUser] = await transaction
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    if (existingUser?.role === 'owner') throw new Error('OWNER_ACCOUNT')
    if (
      existingUser?.status === 'suspended' &&
      existingUser.id !== temporaryUserId
    ) {
      throw new Error('ACCOUNT_SUSPENDED')
    }

    const userId = existingUser?.id ?? randomUUID()
    const name = input.name.trim()
    if (existingUser) {
      await transaction
        .update(user)
        .set({
          emailVerified: true,
          name,
          role: 'collaborator',
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId))
    } else {
      await transaction.insert(user).values({
        id: userId,
        email,
        emailVerified: true,
        name,
        role: 'collaborator',
        status: 'active',
      })
    }

    const inviteArticles = await transaction
      .select({ articleId: collaborationInviteArticle.articleId })
      .from(collaborationInviteArticle)
      .where(eq(collaborationInviteArticle.inviteId, invite.id))
    for (const { articleId } of inviteArticles) {
      await transaction
        .insert(articleGrant)
        .values({ userId, articleId })
        .onDuplicateKeyUpdate({ set: { articleId } })
    }

    await transaction
      .update(collaborationInvite)
      .set({
        claimedAt: new Date(),
        claimedUserId: userId,
        email,
        status: 'activated',
      })
      .where(eq(collaborationInvite.id, invite.id))
      return { email, name, userId }
    })
  } catch (error) {
    if (temporaryUserId) {
      await db.delete(user).where(eq(user.id, temporaryUserId))
    }
    throw error
  }
}

export async function requestCollaboratorLoginOtp(input: {
  email: string
  ip: string
  mailer: OtpEmailSender
}) {
  const email = normalizeEmail(input.email)
  await requireActiveCollaborator(email)
  await createAndSendOtp({
    email,
    ip: input.ip,
    mailer: input.mailer,
    purpose: 'collaborator_login',
  })
}

async function requireActiveCollaborator(email: string) {
  const [existing] = await db
    .select({ id: user.id, role: user.role, status: user.status })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)
  if (!existing || existing.role !== 'collaborator') {
    throw new Error('COLLABORATOR_NOT_FOUND')
  }
  if (existing.status !== 'active') throw new Error('ACCOUNT_SUSPENDED')
  return existing
}

export async function verifyCollaboratorLoginOtp(input: {
  email: string
  otp: string
  headers: Headers
}) {
  const email = normalizeEmail(input.email)
  await requireActiveCollaborator(email)
  return auth.api.signInEmailOTP({
    asResponse: true,
    body: { email, otp: input.otp },
    headers: input.headers,
  })
}
