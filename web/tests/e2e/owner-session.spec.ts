import './database-isolation'
import { expect, test } from '@playwright/test'

test('owner can sign in, update site profile, and revoke the session', async ({
  page,
}) => {
  await page.goto('/studio')
  await expect(page).toHaveURL(/\/studio\/login/)

  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()

  await expect(page).toHaveURL(/\/studio$/)
  await expect(page.getByRole('heading', { name: '写作台' })).toBeVisible()

  await page.goto('/studio/settings')
  await expect(
    page.getByRole('heading', { level: 1, name: '个人资料', exact: true }),
  ).toBeVisible()
  await page.getByLabel('作者昵称').fill('新的站主昵称')
  await page.getByRole('button', { name: '保存资料' }).click()
  await expect(page.getByText('资料已保存')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('作者昵称')).toHaveValue('新的站主昵称')
  await expect(page.getByLabel('所在城市')).toHaveCount(0)

  await page.getByRole('button', { name: '退出写作台' }).click()
  await page
    .getByRole('alertdialog', { name: '退出登录？' })
    .getByRole('button', { name: '退出登录' })
    .click()
  await page.goto('/studio')
  await expect(page).toHaveURL(/\/studio\/login/)
})
