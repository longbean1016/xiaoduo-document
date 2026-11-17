import './database-isolation'
import { expect, test, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
}

async function moveToTrash(page: Page, title: string) {
  await page.goto('/studio')
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('checkbox', { name: `选择 ${title}` }).check()
  await page.getByRole('button', { name: '移入回收站' }).click()
  await page
    .getByRole('alertdialog', { name: '删除这个章节？' })
    .getByRole('button', { name: '移入回收站' })
    .click()
}

test('owner batch restores and permanently deletes trash items', async ({
  page,
}) => {
  await login(page)
  await moveToTrash(page, '写作不是归档')
  await page.getByRole('link', { name: '回收站' }).click()
  await expect(page.getByRole('heading', { name: '回收站' })).toBeVisible()
  await expect(
    page.getByText(/\d+ 天后永久删除/).first(),
  ).toBeVisible()

  await page.getByRole('button', { name: '集中操作' }).click()
  await page.getByRole('checkbox', { name: '选择 写作不是归档' }).check()
  await page.getByRole('button', { name: '恢复所选' }).click()
  await expect(
    page.getByRole('heading', { name: '写作不是归档' }),
  ).toHaveCount(0)

  await moveToTrash(page, '长期维护')
  await page.goto('/studio/trash')
  await page.getByRole('button', { name: '集中操作' }).click()
  await page.getByRole('checkbox', { name: '选择 长期维护' }).check()
  await page.getByRole('button', { name: '永久删除' }).click()

  const confirm = page.getByRole('alertdialog', {
    name: '永久删除这个章节？',
  })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: '取消' }).click()
  await expect(
    page.getByRole('heading', { name: '长期维护' }),
  ).toBeVisible()

  await page.getByRole('button', { name: '永久删除' }).click()
  await page
    .getByRole('alertdialog', { name: '永久删除这个章节？' })
    .getByRole('button', { name: '永久删除', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: '长期维护' }),
  ).toHaveCount(0)
})
