import { beforeEach, describe, expect, it } from 'vitest'
import type { RowDataPacket } from 'mysql2/promise'
import { createTestConnection, resetTestDatabase } from './test-db'

type InviteRow = RowDataPacket & {
  email: string | null
  display_name: string | null
  claimed_user_id: string | null
  claimed_at: Date | null
}

type OtpRequestRow = RowDataPacket & {
  email: string
  purpose: string
  ip_address: string
}

describe('collaboration OTP schema', () => {
  beforeEach(async () => {
    await resetTestDatabase()
  })

  it('allows an unbound invite and records OTP request limits', async () => {
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO collaboration_invite (
          id, token_hash, source, status, expires_at, created_at
        ) VALUES (?, ?, 'direct', 'pending', DATE_ADD(NOW(3), INTERVAL 7 DAY), NOW(3))`,
        ['invite-unbound', 'a'.repeat(64)],
      )
      const [invites] = await connection.query<InviteRow[]>(
        `SELECT email, display_name, claimed_user_id, claimed_at
         FROM collaboration_invite WHERE id = ?`,
        ['invite-unbound'],
      )
      expect(invites[0]).toMatchObject({
        email: null,
        display_name: null,
        claimed_user_id: null,
        claimed_at: null,
      })

      await connection.query(
        `INSERT INTO email_otp_request (
          id, email, purpose, ip_address, requested_at
        ) VALUES (?, ?, ?, ?, NOW(3))`,
        [
          'otp-request-1',
          'writer@example.com',
          'invite_activation',
          '127.0.0.1',
        ],
      )
      const [requests] = await connection.query<OtpRequestRow[]>(
        'SELECT email, purpose, ip_address FROM email_otp_request WHERE id = ?',
        ['otp-request-1'],
      )
      expect(requests[0]).toMatchObject({
        email: 'writer@example.com',
        purpose: 'invite_activation',
        ip_address: '127.0.0.1',
      })
    } finally {
      await connection.end()
    }
  })
})
