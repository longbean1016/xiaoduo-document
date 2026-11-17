import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/client'
import { session } from '@/db/schema'
import { auth } from '@/lib/auth'
import { setCollaboratorStatus } from '@/server/collaboration'
import { createTestConnection, resetTestDatabase } from './test-db'

describe('collaboration management', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO auth_user (
          id, name, email, email_verified, role, status, created_at, updated_at
        ) VALUES (
          'collaborator-1', '协作者甲', 'managed@example.com', true,
          'collaborator', 'active', NOW(3), NOW(3)
        )`,
      )
    } finally {
      await connection.end()
    }
  })

  it('revokes sessions on suspension and restores access without losing grants', async () => {
    const otp = await auth.api.createVerificationOTP({
      body: { email: 'managed@example.com', type: 'sign-in' },
    })
    await auth.api.signInEmailOTP({
      body: { email: 'managed@example.com', otp },
    })
    expect(
      await db
        .select()
        .from(session)
        .where(eq(session.userId, 'collaborator-1')),
    ).toHaveLength(1)

    expect(await setCollaboratorStatus('collaborator-1', 'suspended')).toBe(
      true,
    )
    expect(
      await db
        .select()
        .from(session)
        .where(eq(session.userId, 'collaborator-1')),
    ).toHaveLength(0)
    expect(await setCollaboratorStatus('collaborator-1', 'active')).toBe(true)
  })
})
