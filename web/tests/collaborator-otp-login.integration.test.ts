import { beforeEach, describe, expect, it } from 'vitest'
import {
  requestCollaboratorLoginOtp,
  type OtpEmailSender,
} from '@/server/email-otp'
import { createTestConnection, resetTestDatabase } from './test-db'

function createMailer() {
  const sent: Array<{ email: string; code: string }> = []
  const mailer: OtpEmailSender = {
    async sendOtp({ email, code }) {
      sent.push({ email, code })
    },
  }
  return { mailer, sent }
}

describe('collaborator email OTP login', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO auth_user (
          id, name, email, email_verified, role, status, created_at, updated_at
        ) VALUES
          ('owner-1', '站主', 'owner@qq.com', true,
            'owner', 'active', NOW(3), NOW(3)),
          ('active-1', '协作者', 'active@qq.com', true,
            'collaborator', 'active', NOW(3), NOW(3)),
          ('suspended-1', '停用协作者', 'suspended@qq.com', true,
            'collaborator', 'suspended', NOW(3), NOW(3))`,
      )
    } finally {
      await connection.end()
    }
  })

  it('only sends login codes to active collaborators', async () => {
    const { mailer, sent } = createMailer()

    await requestCollaboratorLoginOtp({
      email: 'ACTIVE@qq.com',
      ip: '127.0.0.1',
      mailer,
    })
    expect(sent).toEqual([
      {
        email: 'active@qq.com',
        code: expect.stringMatching(/^\d{6}$/),
      },
    ])

    await expect(
      requestCollaboratorLoginOtp({
        email: 'missing@qq.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('COLLABORATOR_NOT_FOUND')
    await expect(
      requestCollaboratorLoginOtp({
        email: 'owner@qq.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('COLLABORATOR_NOT_FOUND')
    await expect(
      requestCollaboratorLoginOtp({
        email: 'suspended@qq.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('ACCOUNT_SUSPENDED')
    expect(sent).toHaveLength(1)
  })
})
