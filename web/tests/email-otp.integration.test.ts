import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { RowDataPacket } from 'mysql2/promise'
import { auth } from '@/lib/auth'
import {
  activateInvitationWithOtp,
  requestInviteOtp,
  type OtpEmailSender,
} from '@/server/email-otp'
import { createDirectInvite } from '@/server/collaboration'
import { createTestConnection, resetTestDatabase } from './test-db'

type UserRow = RowDataPacket & {
  id: string
  email: string
  name: string
  role: string
  status: string
}

type GrantRow = RowDataPacket & {
  article_id: string
}

type InviteRow = RowDataPacket & {
  email: string | null
  claimed_user_id: string | null
  status: string
  claimed_at: Date | null
}

type VerificationRow = RowDataPacket & {
  lifetime_seconds: number
}

async function seedArticle() {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO category (id, title, slug, position)
       VALUES ('category-1', '工具与方法', 'tools', 1)`,
    )
    await connection.query(
      `INSERT INTO article (
        id, category_id, title, path, position, markdown, plain_text,
        revision, publication_state, created_at, updated_at
      ) VALUES (
        'article-1', 'category-1', '协作文章', '协作文章', 1,
        '正文', '正文', 1, 'published', NOW(3), NOW(3)
      )`,
    )
  } finally {
    await connection.end()
  }
}

function createMailer() {
  const sent: Array<{ email: string; code: string }> = []
  const mailer: OtpEmailSender = {
    async sendOtp({ email, code }) {
      sent.push({ email, code })
    },
  }
  return { mailer, sent }
}

async function insertOtpRequests(
  entries: Array<{ email: string; ip: string; secondsAgo: number }>,
) {
  const connection = await createTestConnection()
  try {
    for (const entry of entries) {
      await connection.query(
        `INSERT INTO email_otp_request (
          id, email, purpose, ip_address, requested_at
        ) VALUES (?, ?, 'invite_activation', ?, ?)`,
        [
          randomUUID(),
          entry.email,
          entry.ip,
          new Date(Date.now() - entry.secondsAgo * 1_000),
        ],
      )
    }
  } finally {
    await connection.end()
  }
}

describe('email OTP invitation activation', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    await seedArticle()
  })

  it('rotates the latest OTP after cooldown', async () => {
    const invite = await createDirectInvite({ articleIds: ['article-1'] })
    const { mailer, sent } = createMailer()

    await requestInviteOtp({
      token: invite.token!,
      email: 'writer@example.com',
      ip: '127.0.0.1',
      mailer,
    })
    expect(sent).toHaveLength(1)
    expect(sent[0].code).toMatch(/^\d{6}$/)

    await expect(
      requestInviteOtp({
        token: invite.token!,
        email: 'writer@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OTP_COOLDOWN')

    const userConnection = await createTestConnection()
    try {
      await userConnection.query(
        `UPDATE email_otp_request
         SET requested_at = DATE_SUB(NOW(3), INTERVAL 2 MINUTE)
         WHERE email = ?`,
        ['writer@example.com'],
      )
    } finally {
      await userConnection.end()
    }

    await requestInviteOtp({
      token: invite.token!,
      email: 'writer@example.com',
      ip: '127.0.0.1',
      mailer,
    })
    expect(sent).toHaveLength(2)
    expect(sent[1].code).not.toBe(sent[0].code)
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO auth_user (
          id, name, email, email_verified, role, status, created_at, updated_at
        ) VALUES (
          'writer-1', '写作者', 'writer@example.com', true,
          'collaborator', 'active', NOW(3), NOW(3)
        )`,
      )
    } finally {
      await connection.end()
    }
    await expect(
      auth.api.checkVerificationOTP({
        body: {
          email: 'writer@example.com',
          otp: sent[0].code,
          type: 'sign-in',
        },
      }),
    ).rejects.toThrow()
    await expect(
      auth.api.checkVerificationOTP({
        body: {
          email: 'writer@example.com',
          otp: sent[1].code,
          type: 'sign-in',
        },
      }),
    ).resolves.toMatchObject({ success: true })
  })

  it('locks an OTP after five failed attempts', async () => {
    const invite = await createDirectInvite({ articleIds: ['article-1'] })
    const { mailer, sent } = createMailer()

    await requestInviteOtp({
      token: invite.token!,
      email: 'writer@example.com',
      ip: '127.0.0.1',
      mailer,
    })

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        activateInvitationWithOtp({
          token: invite.token!,
          email: 'writer@example.com',
          name: '写作者',
          otp: '000000',
        }),
      ).rejects.toThrow()
    }

    await expect(
      activateInvitationWithOtp({
        token: invite.token!,
        email: 'writer@example.com',
        name: '写作者',
        otp: sent[0].code,
      }),
    ).rejects.toThrow()
  })

  it('keeps an OTP valid for ten minutes', async () => {
    const invite = await createDirectInvite({ articleIds: ['article-1'] })
    const { mailer } = createMailer()

    await requestInviteOtp({
      token: invite.token!,
      email: 'writer@example.com',
      ip: '127.0.0.1',
      mailer,
    })

    const connection = await createTestConnection()
    try {
      const [rows] = await connection.query<VerificationRow[]>(
        `SELECT TIMESTAMPDIFF(
          SECOND, created_at, expires_at
        ) AS lifetime_seconds
        FROM auth_verification
        WHERE identifier = ?`,
        ['sign-in-otp-writer@example.com'],
      )
      expect(rows[0].lifetime_seconds).toBe(600)
    } finally {
      await connection.end()
    }
  })

  it('does not send an OTP for an unavailable invitation', async () => {
    const invite = await createDirectInvite({ articleIds: ['article-1'] })
    const { mailer, sent } = createMailer()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `UPDATE collaboration_invite SET status = 'revoked' WHERE id = ?`,
        [invite.id],
      )
    } finally {
      await connection.end()
    }

    await expect(
      requestInviteOtp({
        token: invite.token!,
        email: 'writer@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('INVITE_NOT_PENDING')
    expect(sent).toHaveLength(0)
  })

  it('enforces email hourly, email daily and IP hourly limits', async () => {
    const invite = await createDirectInvite({ articleIds: ['article-1'] })
    const { mailer, sent } = createMailer()

    await insertOtpRequests(
      Array.from({ length: 5 }, (_, index) => ({
        email: 'hourly@example.com',
        ip: `10.0.0.${index + 1}`,
        secondsAgo: 120 + index,
      })),
    )
    await expect(
      requestInviteOtp({
        token: invite.token!,
        email: 'hourly@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OTP_EMAIL_HOURLY_LIMIT')

    await insertOtpRequests(
      Array.from({ length: 10 }, (_, index) => ({
        email: 'daily@example.com',
        ip: `10.0.1.${index + 1}`,
        secondsAgo: 7_200 + index * 1_800,
      })),
    )
    await expect(
      requestInviteOtp({
        token: invite.token!,
        email: 'daily@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OTP_EMAIL_DAILY_LIMIT')

    await insertOtpRequests(
      Array.from({ length: 10 }, (_, index) => ({
        email: `ip-${index}@example.com`,
        ip: '192.0.2.8',
        secondsAgo: 120 + index,
      })),
    )
    await expect(
      requestInviteOtp({
        token: invite.token!,
        email: 'new-writer@example.com',
        ip: '192.0.2.8',
        mailer,
      }),
    ).rejects.toThrow('OTP_IP_HOURLY_LIMIT')
    expect(sent).toHaveLength(0)
  })

  it('binds the invite, activates the collaborator and grants articles', async () => {
    const invite = await createDirectInvite({ articleIds: ['article-1'] })
    const { mailer, sent } = createMailer()

    await requestInviteOtp({
      token: invite.token!,
      email: 'writer@example.com',
      ip: '127.0.0.1',
      mailer,
    })
    const activated = await activateInvitationWithOtp({
      token: invite.token!,
      email: 'writer@example.com',
      name: '写作者',
      otp: sent[0].code,
    })

    expect(activated).toMatchObject({
      email: 'writer@example.com',
      name: '写作者',
    })
    const connection = await createTestConnection()
    try {
      const [users] = await connection.query<UserRow[]>(
        `SELECT id, email, name, role, status
         FROM auth_user WHERE email = ?`,
        ['writer@example.com'],
      )
      expect(users[0]).toMatchObject({
        email: 'writer@example.com',
        name: '写作者',
        role: 'collaborator',
        status: 'active',
      })
      const [grants] = await connection.query<GrantRow[]>(
        `SELECT article_id FROM article_grant WHERE user_id = ?`,
        [users[0].id],
      )
      expect(grants).toEqual([{ article_id: 'article-1' }])
      const [invites] = await connection.query<InviteRow[]>(
        `SELECT email, claimed_user_id, status, claimed_at
         FROM collaboration_invite WHERE id = ?`,
        [invite.id],
      )
      expect(invites[0]).toMatchObject({
        email: 'writer@example.com',
        claimed_user_id: users[0].id,
        status: 'activated',
      })
      expect(invites[0].claimed_at).toBeTruthy()
    } finally {
      await connection.end()
    }
  })
})
