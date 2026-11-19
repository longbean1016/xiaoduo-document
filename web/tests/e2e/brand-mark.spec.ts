import './database-isolation'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('public library and studio use the Xiaoduo round portrait mark', async ({
  page,
}) => {
  await page.goto('/library')

  const publicBrand = page.locator('.library-brand')
  await expect(
    publicBrand.getByText('小多笔记', { exact: true }),
  ).toBeVisible()
  const publicIcon = publicBrand.locator('.brand-mark-icon')
  await expect(publicIcon).toHaveCSS('border-radius', '50%')
  await expect(publicIcon).toHaveCSS('width', '40px')
  const publicImage = publicIcon.locator('img')
  await expect(publicImage).toHaveAttribute(
    'src',
    /xiaoduo-brand-v2\.webp/,
  )
  await expect
    .poll(() =>
      publicImage.evaluate((image) => {
        const element = image as HTMLImageElement
        return element.complete
          ? {
              width: element.naturalWidth,
              height: element.naturalHeight,
            }
          : null
      }),
    )
    .toEqual(
      expect.objectContaining({
        width: 512,
        height: 512,
      }),
    )
  expect(
    await publicImage.evaluate(
      (element) => getComputedStyle(element).transform,
    ),
  ).toBe('none')

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(publicIcon).toBeVisible()
  await expect(
    publicBrand.getByText('小多笔记', { exact: true }),
  ).toBeHidden()

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const studioBrand = page.locator('.studio-sidebar .brand-mark')
  await expect(
    studioBrand.getByText('小多写作台', { exact: true }),
  ).toBeVisible()
  await expect(studioBrand.locator('.brand-mark-icon')).toBeVisible()
})

test('public library and studio expose Xiaoduo titles and favicon', async ({
  page,
  request,
}) => {
  await page.goto('/library')
  await expect(page).toHaveTitle('小多笔记')

  const faviconHref = await page
    .locator('link[rel="icon"]')
    .first()
    .getAttribute('href')
  expect(faviconHref).toBeTruthy()
  const favicon = await request.get(faviconHref!)
  expect(favicon.ok()).toBe(true)
  expect(favicon.headers()['content-type']).toContain('image/png')

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await expect(page).toHaveTitle('小多写作台')
})

test('Xiaoduo avatar source is high resolution and square', async ({
  page,
}) => {
  await page.goto('/')

  const dimensions = await page.evaluate(async () => {
    const image = new Image()
    image.src = '/xiaoduo-brand-v2.webp'
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  })

  expect(dimensions.width).toBeGreaterThanOrEqual(512)
  expect(dimensions.height).toBeGreaterThanOrEqual(512)
})

test('uploaded profile avatar is reused by public and studio brand marks', async ({
  page,
}) => {
  const avatarUrl = '/xiaoduo-mark.jpg'
  const connection = await createTestConnection()
  try {
    await connection.query(
      `UPDATE site_profile SET avatar_url = ? WHERE id = 'primary'`,
      [avatarUrl],
    )
  } finally {
    await connection.end()
  }

  await page.goto('/library')
  await expect(
    page.locator('.library-brand .brand-mark-icon img'),
  ).toHaveAttribute('src', avatarUrl)

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await expect(
    page.locator('.studio-sidebar .brand-mark-icon img'),
  ).toHaveAttribute('src', avatarUrl)

  await page.goto('/studio/settings')
  await expect(
    page.locator('.studio-profile-avatar-section img'),
  ).toHaveAttribute('src', avatarUrl)
})

test('author and profile avatars use the brand icon framing', async ({
  page,
}) => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `UPDATE site_profile SET avatar_url = ? WHERE id = 'primary'`,
      ['/xiaoduo-brand-v2.webp'],
    )
  } finally {
    await connection.end()
  }

  await page.goto('/library/attention-and-writing/写作不是归档')
  const articleAvatar = page.locator('.chapter-author img').first()
  await expect(articleAvatar).toBeVisible()
  await expect(articleAvatar).toHaveCSS('width', '40px')
  await expect(articleAvatar).toHaveCSS('height', '40px')
  await expect(articleAvatar).toHaveCSS('border-radius', '50%')
  await expect(articleAvatar).toHaveCSS('object-position', '50% 45%')
  expect(
    await articleAvatar.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    ),
  ).not.toBe('none')

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/settings')
  const profileAvatar = page.locator('.studio-profile-avatar-section img')
  await expect(profileAvatar).toBeVisible()
  await expect(profileAvatar).toHaveCSS('width', '40px')
  await expect(profileAvatar).toHaveCSS('height', '40px')
  await expect(profileAvatar).toHaveCSS('border-radius', '50%')
  await expect(profileAvatar).toHaveCSS('object-position', '50% 45%')
  expect(
    await profileAvatar.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    ),
  ).not.toBe('none')
})
