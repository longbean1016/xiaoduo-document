import './database-isolation'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { db } from '../../src/db/client'
import { collaborationInvite } from '../../src/db/schema'
import { createDirectInvite } from '../../src/server/collaboration'
import {
  requestInviteOtp,
  type OtpEmailSender,
} from '../../src/server/email-otp'

test.beforeEach(async () => {
  const { seedTestDatabase } = await import('../seed-test-db')
  await seedTestDatabase()
})

test('invitee activates with email OTP and enters the studio', async ({
  page,
}) => {
  const invite = await createDirectInvite({ articleIds: ['article-1'] })
  let sentCode = ''
  const mailer: OtpEmailSender = {
    async sendOtp({ code }) {
      sentCode = code
    },
  }

  await page.route(
    '**/api/collaboration/invites/request-otp',
    async (route) => {
      await requestInviteOtp({
        token: invite.token!,
        email: 'invitee@example.com',
        ip: '127.0.0.1',
        mailer,
      })
      await route.fulfill({ json: { sent: true } })
    },
  )

  await page.goto(`/collaborate/accept/${invite.token}`)
  await expect(
    page.getByRole('heading', { level: 1, name: '接受协作邀请' }),
  ).toBeVisible()
  await expect(page.getByText('写作不是归档')).toBeVisible()
  await expect(page.getByText(/邀请将在 .* 过期/)).toBeVisible()
  await expect(page.getByLabel('邮箱')).toHaveValue('')
  await expect(page.getByLabel('设置密码')).toHaveCount(0)

  await page.getByLabel('邮箱').fill('invitee@example.com')
  await page.getByLabel('昵称').fill('协作者乙')
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(
    page.getByRole('button', { name: /重新发送/ }),
  ).toBeDisabled()
  expect(sentCode).toMatch(/^\d{6}$/)

  await page.getByLabel('验证码').fill(sentCode)
  await page.getByRole('button', { name: '激活并进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes('session_token'),
  )
  expect(sessionCookie?.httpOnly).toBe(true)

  await page.goto(`/collaborate/accept/${invite.token}`)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '这个邀请已经激活',
    }),
  ).toBeVisible()
})

test('invite page explains expired and revoked invitations', async ({
  page,
}) => {
  const expired = await createDirectInvite({
    articleIds: ['article-1'],
  })
  await db
    .update(collaborationInvite)
    .set({ status: 'expired' })
    .where(eq(collaborationInvite.id, expired.id))

  await page.goto(`/collaborate/accept/${expired.token}`)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '邀请链接已过期',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('此邀请已过期，请联系站主重新邀请。'),
  ).toBeVisible()

  const revoked = await createDirectInvite({
    articleIds: ['article-1'],
  })
  await db
    .update(collaborationInvite)
    .set({ status: 'revoked' })
    .where(eq(collaborationInvite.id, revoked.id))

  await page.goto(`/collaborate/accept/${revoked.token}`)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: '邀请已经被撤销',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('此邀请已撤销，请联系站主。'),
  ).toBeVisible()
})
