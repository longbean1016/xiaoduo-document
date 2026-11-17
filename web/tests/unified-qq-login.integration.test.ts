import { beforeEach, describe, expect, it } from 'vitest'
import {
  requestStudioLoginOtp,
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

describe('unified QQ mailbox login', () => {
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
          ('collaborator-1', '协作者', 'writer@foxmail.com', true,
            'collaborator', 'active', NOW(3), NOW(3)),
          ('suspended-1', '停用账号', 'suspended@vip.qq.com', true,
            'collaborator', 'suspended', NOW(3), NOW(3))`,
      )
    } finally {
      await connection.end()
    }
  })

  it('sends codes only for valid QQ addresses on active studio accounts', async () => {
    const { mailer, sent } = createMailer()

    await requestStudioLoginOtp({
      email: 'OWNER@qq.com',
      ip: '127.0.0.1',
      mailer,
    })
    await requestStudioLoginOtp({
      email: 'writer@foxmail.com',
      ip: '127.0.0.2',
      mailer,
    })
    expect(sent).toEqual([
      {
        email: 'owner@qq.com',
        code: expect.stringMatching(/^\d{6}$/),
      },
      {
        email: 'writer@foxmail.com',
        code: expect.stringMatching(/^\d{6}$/),
      },
    ])

    await expect(
      requestStudioLoginOtp({
        email: 'missing@qq.com',
        ip: '127.0.0.3',
        mailer,
      }),
    ).rejects.toThrow('STUDIO_ACCOUNT_NOT_FOUND')
    await expect(
      requestStudioLoginOtp({
        email: 'suspended@vip.qq.com',
        ip: '127.0.0.4',
        mailer,
      }),
    ).rejects.toThrow('ACCOUNT_SUSPENDED')
    await expect(
      requestStudioLoginOtp({
        email: 'owner@gmail.com',
        ip: '127.0.0.5',
        mailer,
      }),
    ).rejects.toThrow('INVALID_QQ_EMAIL')
    expect(sent).toHaveLength(2)
  })
})
