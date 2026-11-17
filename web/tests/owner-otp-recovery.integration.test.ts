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
          ('owner-1', '站主', 'owner@example.com', true,
            'owner', 'active', NOW(3), NOW(3)),
          ('owner-suspended', '停用站主', 'suspended-owner@example.com', true,
            'owner', 'suspended', NOW(3), NOW(3)),
          ('collaborator-1', '协作者', 'collaborator@example.com', true,
            'collaborator', 'active', NOW(3), NOW(3))`,
      )
    } finally {
      await connection.end()
    }
  })

  it('only sends recovery codes to the active owner', async () => {
    const { mailer, sent } = createMailer()

    await requestOwnerRecoveryOtp({
      email: 'OWNER@example.com',
      ip: '127.0.0.1',
      mailer,
    })
    expect(sent).toEqual([
      {
        email: 'owner@example.com',
        code: expect.stringMatching(/^\d{6}$/),
      },
    ])

    await expect(
      requestOwnerRecoveryOtp({
        email: 'missing@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OWNER_NOT_FOUND')
    await expect(
      requestOwnerRecoveryOtp({
        email: 'collaborator@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('OWNER_NOT_FOUND')
    await expect(
      requestOwnerRecoveryOtp({
        email: 'suspended-owner@example.com',
        ip: '127.0.0.1',
        mailer,
      }),
    ).rejects.toThrow('ACCOUNT_SUSPENDED')
    expect(sent).toHaveLength(1)
  })
})
