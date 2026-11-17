import { beforeEach, describe, expect, it } from 'vitest'
import {
  requestOwnerRecoveryOtp,
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

describe('owner email OTP recovery', () => {
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
          ('owner-suspended', '停用站主', 'suspended-owner@qq.com', true,
            'owner', 'suspended', NOW(3), NOW(3)),
          ('collaborator-1', '协作者', 'collaborator@qq.com', true,
            'collaborator', 'active', NOW(3), NOW(3))`,
      )
    } finally {
      await connection.end()
    }
  })

  it('only sends recovery codes to the active owner', async () => {
    const { mailer, sent } = createMailer()

    await requestOwnerRecoveryOtp({
      email: 'OWNER@qq.com',
      ip: '127.0.0.1',
      mailer,
    })
    expect(sent).toEqual([
      {
        email: 'owner@qq.com',
        code: expect.stringMatching(/^\d{6}$/),
      },
    ])

    await expect(
      requestOwnerRecoveryOtp({
        email: 'missing@qq.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OWNER_NOT_FOUND')
    await expect(
      requestOwnerRecoveryOtp({
        email: 'collaborator@qq.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OWNER_NOT_FOUND')
    await expect(
      requestOwnerRecoveryOtp({
        email: 'suspended-owner@qq.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('ACCOUNT_SUSPENDED')
    expect(sent).toHaveLength(1)
  })
})
