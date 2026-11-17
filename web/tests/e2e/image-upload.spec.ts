import './database-isolation'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { appOrigin } from './app-origin'

const onePixelPng = await sharp({
  create: {
    width: 1,
    height: 1,
    channels: 4,
    background: { r: 68, g: 120, b: 187, alpha: 1 },
  },
})
  .png()
  .toBuffer()

test('editor compresses and uploads an image without embedding OSS credentials', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.goto('/studio/notes/article-1')

  let uploadedBytes = 0
  let uploadedContentType = ''
  await page.route('https://test-bucket.oss-cn-hangzhou.aliyuncs.com/**', async (route) => {
    uploadedBytes = route.request().postDataBuffer()?.length ?? 0
    uploadedContentType = route.request().headers()['content-type'] ?? ''
    await route.fulfill({
      status: 200,
      body: '',
      headers: {
        'access-control-allow-origin': appOrigin,
        'access-control-allow-methods': 'PUT',
        'access-control-allow-headers': 'content-type',
      },
    })
  })
  await page.route('https://cdn.example.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: onePixelPng,
    })
  })

  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().startsWith(
        'https://test-bucket.oss-cn-hangzhou.aliyuncs.com/',
      ),
  )
  const [signResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith('/api/studio/articles/article-1/images'),
    ),
    page.getByLabel('选择正文图片').setInputFiles({
      name: 'diagram.png',
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
  expect(uploadedBytes).toBeGreaterThan(0)
  expect(uploadedContentType).toBe(signPayload.upload.contentType)
  await expect(page.getByText('图片已插入')).toBeVisible()
  await expect(
    page
      .getByRole('textbox', { name: '章节正文' })
      .locator('img'),
  ).toHaveAttribute('src', signPayload.upload.publicUrl)

  await page.keyboard.press('ControlOrMeta+KeyS')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  await page.getByRole('button', { name: /发布章节|更新发布/ }).click()
  await expect(page.getByRole('button', { name: '已是最新' })).toBeDisabled()
  await page.reload()
  await expect(
    page
      .getByRole('textbox', { name: '章节正文' })
      .locator('img'),
  ).toHaveAttribute('src', signPayload.upload.publicUrl)
  await page.goto('/library/attention-and-writing/写作不是归档')
  await expect(page.locator('.markdown-body img')).toHaveAttribute(
    'src',
    signPayload.upload.publicUrl,
  )
  await page.goto('/studio/notes/article-1')

  await page.unroute('https://test-bucket.oss-cn-hangzhou.aliyuncs.com/**')
  await page.route(
    'https://test-bucket.oss-cn-hangzhou.aliyuncs.com/**',
    async (route) => {
      await route.fulfill({
        status: 500,
        body: 'upload failed',
        headers: {
          'access-control-allow-origin': appOrigin,
          'access-control-allow-methods': 'PUT',
          'access-control-allow-headers': 'content-type',
        },
      })
    },
  )
  await page.getByLabel('选择正文图片').setInputFiles({
    name: 'second.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  })
  await expect(page.getByText('图片上传失败，请重试')).toBeVisible()
  await expect(
    page
      .getByRole('textbox', { name: '章节正文' })
      .locator('img'),
  ).toHaveCount(1)
})
