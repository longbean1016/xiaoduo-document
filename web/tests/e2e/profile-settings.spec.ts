import './database-isolation'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { appOrigin } from './app-origin'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

const onePixelPng = await sharp({
  create: {
    width: 8,
    height: 8,
    channels: 4,
    background: { r: 104, g: 188, b: 158, alpha: 1 },
  },
})
  .png()
  .toBuffer()

test('owner uploads an avatar and saves the author name', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/settings')
  await expect(page.getByLabel('作者昵称')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '选择本地头像' }),
  ).toBeVisible()
  for (const hiddenLabel of [
    '头像地址',
    '身份说明',
    '所在城市',
    '联系邮箱',
    '简介',
    '最近在做什么',
  ]) {
    await expect(page.getByLabel(hiddenLabel)).toHaveCount(0)
  }

  await page.route(
    'https://test-bucket.oss-cn-hangzhou.aliyuncs.com/**',
    async (route) => {
      await route.fulfill({
        status: 200,
        body: '',
        headers: {
          'access-control-allow-origin': appOrigin,
          'access-control-allow-methods': 'PUT',
          'access-control-allow-headers': 'content-type',
        },
      })
    },
  )
  await page.route('https://cdn.example.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: onePixelPng,
    })
  })

  const avatarInput = page.getByLabel('选择本地头像')
  const preview = page.locator('.studio-profile-avatar-section img')
  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().startsWith(
        'https://test-bucket.oss-cn-hangzhou.aliyuncs.com/',
      ),
  )
  const [signResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith('/api/studio/profile/avatar'),
    ),
    avatarInput.setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: onePixelPng,
    }),
  ])
  expect(signResponse.status()).toBe(201)
  const signPayload = (await signResponse.json()) as {
    upload: {
      uploadUrl: string
      publicUrl: string
      contentType: string
    }
  }
  expect(JSON.stringify(signPayload)).not.toContain('test-access-secret')
  await uploadResponsePromise
  await expect(
    page.getByText('头像上传成功，保存资料后生效。'),
  ).toBeVisible()
  await expect(preview).toHaveAttribute(
    'src',
    signPayload.upload.publicUrl,
  )

  await page.getByRole('button', { name: '移除头像' }).click()
  const removeDialog = page.getByRole('alertdialog', {
    name: '移除这个头像？',
  })
  await expect(removeDialog).toBeVisible()
  await removeDialog.getByRole('button', { name: '取消' }).click()
  await expect(preview).toBeVisible()

  await page.getByRole('button', { name: '移除头像' }).click()
  await removeDialog.getByRole('button', { name: '移除头像' }).click()
  await expect(preview).toHaveCount(0)

  await avatarInput.setInputFiles({
    name: 'avatar.webp',
    mimeType: 'image/webp',
    buffer: onePixelPng,
  })
  await page.getByLabel('作者昵称').fill('只显示昵称')
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('资料已保存')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('作者昵称')).toHaveValue('只显示昵称')
  await expect(page.getByLabel('所在城市')).toHaveCount(0)
  await expect(preview).toBeVisible()
})

test('profile avatar signing requires the owner and a trusted origin', async ({
  page,
  request,
}) => {
  const payload = { contentType: 'image/webp', size: 20_000 }

  const anonymous = await request.post('/api/studio/profile/avatar', {
    data: payload,
  })
  expect(anonymous.status()).toBe(403)

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const invalidOrigin = await page.request.post(
    '/api/studio/profile/avatar',
    {
      data: payload,
      headers: { origin: 'https://invalid.example.com' },
    },
  )
  expect(invalidOrigin.status()).toBe(403)
})
