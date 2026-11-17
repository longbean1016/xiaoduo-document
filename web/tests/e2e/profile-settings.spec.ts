import './database-isolation'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner edits only the local avatar preview and author name', async ({
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

  const avatarInput = page.getByLabel('选择本地头像')
  const source = sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: '#74b59e',
    },
  })
  const avatarFiles = [
    {
      name: 'avatar.jpg',
      mimeType: 'image/jpeg',
      buffer: await source.clone().jpeg().toBuffer(),
    },
    {
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: await source.clone().png().toBuffer(),
    },
    {
      name: 'avatar.webp',
      mimeType: 'image/webp',
      buffer: await source.clone().webp().toBuffer(),
    },
  ]
  const preview = page.locator('.studio-profile-avatar-section img')
  for (const avatarFile of avatarFiles) {
    await avatarInput.setInputFiles(avatarFile)
    await expect(
      page.getByText('头像已在本地预览，对象存储接入后即可保存。'),
    ).toBeVisible()
    await expect(preview).toHaveAttribute('src', /^blob:/)
  }

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

  await avatarInput.setInputFiles(avatarFiles[1])
  await page.getByLabel('作者昵称').fill('只显示昵称')
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(
    page.getByText('昵称已保存。本地头像将在对象存储接入后上传。'),
  ).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('作者昵称')).toHaveValue('只显示昵称')
  await expect(page.getByLabel('所在城市')).toHaveCount(0)
})
