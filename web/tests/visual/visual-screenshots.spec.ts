import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { auth } from '../../src/lib/auth'
import { compareVisualScreenshots } from './compare'
import { visualFixture } from './fixture'
import {
  visualCases,
  visualOrigins,
  visualViewports,
  type VisualRole,
} from './visual-cases'

const enforce = process.env.VISUAL_ENFORCE === '1'
const tolerance = Number(process.env.VISUAL_TOLERANCE ?? 0)
const artifactRoot = path.join(
  process.cwd(),
  '..',
  '.scratch',
  'ui-revamp',
  'screenshots',
  process.env.VISUAL_TICKET ?? '01',
)

test.setTimeout(180_000)

async function preparePage(
  page: Page,
  role: VisualRole,
  themeMode: 'light' | 'dark',
) {
  await page.clock.install({ time: new Date(visualFixture.fixedNow) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(
    ({ state, key, initialRole, prototypeThemeMode }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            ...state,
            studioAuthed: initialRole !== null,
            studioRole: initialRole,
            currentCollaboratorId:
              initialRole === 'collaborator' ? 'collaborator-1' : null,
            themeMode: prototypeThemeMode,
          },
          version: 7,
        }),
      )
    },
    {
      state: visualFixture.prototypeState,
      key: visualFixture.prototypeStorageKey,
      initialRole: role,
      prototypeThemeMode: themeMode,
    },
  )
}

async function prepareProductionPage(
  page: Page,
  role: VisualRole,
  targetPath: string,
  themeMode: 'light' | 'dark',
) {
  await page.clock.install({ time: new Date(visualFixture.fixedNow) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript((theme) => {
    localStorage.setItem('zhijian-theme', theme)
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, themeMode)
  if (role) {
    const login =
      role === 'owner'
        ? await page.request.post(
            `${visualOrigins.production}/api/auth/sign-in/email`,
            {
              headers: { origin: visualOrigins.production },
              data: {
                email: 'owner@example.com',
                password: 'owner-test-password',
              },
            },
          )
        : await (async () => {
            const otp = await auth.api.createVerificationOTP({
              body: { email: 'zhou@qq.com', type: 'sign-in' },
            })
            return page.request.post(
              `${visualOrigins.production}/api/collaboration/login/verify-otp`,
              {
                headers: { origin: visualOrigins.production },
                data: { email: 'zhou@qq.com', otp },
              },
            )
          })()
    expect(login.ok()).toBeTruthy()
  }
  await page.goto(`${visualOrigins.production}${targetPath}`)
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  })
}

async function applyTheme(page: Page, themeMode: 'light' | 'dark') {
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, themeMode)
}

async function applyDesignTokenSample(page: Page) {
  await page.evaluate(() => {
    document.body.innerHTML = `
      <main class="token-specimen">
        <header>
          <span class="section-kicker">Design tokens</span>
          <h1 class="font-display">把零散的知识整理成书</h1>
          <p>同一组颜色、字体、间距、圆角、边框与焦点规则。</p>
        </header>
        <section class="swatches" aria-label="颜色">
          <span class="canvas"></span>
          <span class="panel"></span>
          <span class="field"></span>
          <span class="ink"></span>
          <span class="muted"></span>
          <span class="line"></span>
          <span class="accent"></span>
          <span class="rust"></span>
          <span class="gold"></span>
        </section>
        <section class="surfaces">
          <article>
            <strong class="font-display">Panel</strong>
            <p>正文使用稳定行高和舒展留白。</p>
            <button type="button">主要操作</button>
          </article>
          <label>
            输入字段
            <input value="专注写作" />
          </label>
        </section>
      </main>
    `
    const style = document.createElement('style')
    style.textContent = `
      html,body { margin:0; min-height:100%; background:var(--canvas); color:var(--ink); }
      .token-specimen { width:min(960px, calc(100% - 48px)); margin:0 auto; padding:48px 0; }
      .token-specimen header { display:grid; gap:14px; }
      .token-specimen h1 { margin:0; font-size:48px; line-height:1.12; }
      .token-specimen p { margin:0; color:var(--muted); line-height:1.7; }
      .swatches { display:grid; grid-template-columns:repeat(9, minmax(0, 1fr)); gap:10px; margin-top:32px; }
      .swatches span { aspect-ratio:1; border:1px solid var(--line); border-radius:6px; }
      .swatches .canvas { background:var(--canvas); }
      .swatches .panel { background:var(--panel); }
      .swatches .field { background:var(--field); }
      .swatches .ink { background:var(--ink); }
      .swatches .muted { background:var(--muted); }
      .swatches .line { background:var(--line-strong); }
      .swatches .accent { background:var(--accent); }
      .swatches .rust { background:var(--rust); }
      .swatches .gold { background:var(--gold); }
      .surfaces { display:grid; grid-template-columns:2fr 1fr; gap:16px; margin-top:24px; }
      .surfaces article, .surfaces label { display:grid; gap:12px; border:1px solid var(--line); border-radius:8px; padding:20px; background:var(--panel); }
      .surfaces strong { font-size:26px; }
      .surfaces button, .surfaces input { border:1px solid var(--line-strong); border-radius:5px; padding:10px 12px; font:inherit; }
      .surfaces button { width:max-content; background:var(--ink); color:var(--canvas); }
      @media (max-width:700px) {
        .token-specimen { width:calc(100% - 32px); padding:32px 0; }
        .token-specimen h1 { font-size:36px; }
        .swatches { grid-template-columns:repeat(3, minmax(0, 1fr)); }
        .surfaces { grid-template-columns:1fr; }
      }
    `
    document.head.append(style)
  })
}

async function applyVisualInteraction(
  page: Page,
  interaction: NonNullable<
    (typeof visualCases)[number]['interaction']
  >,
  searchQuery?: string,
) {
  if (interaction === 'open-library-sidebar') {
    const openButton = page.getByRole('button', { name: '打开目录' })
    if (await openButton.isVisible()) await openButton.click()
    return
  }
  if (interaction === 'open-public-search') {
    await page.getByRole('button', { name: '搜索' }).first().click()
    await expect(
      page.getByRole('dialog', { name: '搜索知笺' }),
    ).toBeVisible()
    await page
      .getByPlaceholder('搜索分类或章节')
      .fill(searchQuery ?? '写作')
    return
  }
  if (interaction === 'open-version-history') {
    if ((page.viewportSize()?.width ?? 1280) <= 767) {
      await page.getByRole('button', { name: '历史', exact: true }).click()
    } else {
      await page.getByRole('button', { name: '版本历史' }).click()
    }
    await expect(
      page.getByRole('dialog', { name: '版本历史' }),
    ).toBeVisible()
  }
  if (interaction === 'open-version-diff') {
    if ((page.viewportSize()?.width ?? 1280) <= 767) {
      await page.getByRole('button', { name: '历史', exact: true }).click()
    } else {
      await page.getByRole('button', { name: '版本历史' }).click()
    }
    const history = page.getByRole('dialog', { name: '版本历史' })
    await expect(history).toBeVisible()
    await history
      .getByRole('button', {
        name: /对比上一版本|查看与上一版本的变化/,
      })
      .first()
      .click()
    await expect(
      page.getByRole('dialog', { name: '版本变化' }),
    ).toBeVisible()
  }
}

function masks(page: Page, extraSelectors: string[] = []) {
  return [...visualFixture.maskSelectors, ...extraSelectors].map((selector) =>
    page.locator(selector),
  )
}

test('shared components support dialog focus, tooltip, and keyboard select', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(visualFixture.fixedNow) })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${visualOrigins.production}/visual-fixtures/components`)

  const opener = page.getByRole('button', { name: '打开对话框' })
  await opener.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: '组件对话框' })
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()

  const tooltipTrigger = page.getByRole('button', { name: '查看格式提示' })
  await tooltipTrigger.hover()
  await expect(page.getByRole('tooltip')).toHaveText('支持 Markdown 快捷输入')

  const select = page.getByRole('button', { name: '章节状态' })
  await select.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: '草稿' })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(select).toHaveText(/已发布/)
})

test('public search opens by shortcut and returns focus', async ({ page }) => {
  await page.goto(`${visualOrigins.production}/visual-fixtures/public-shell`)
  await page.keyboard.press('ControlOrMeta+KeyK')
  const dialog = page.getByRole('dialog', { name: '搜索知笺' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('搜索公开章节')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: '搜索' })).toBeFocused()
})

test('mobile library navigation moves focus into the drawer and back', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`${visualOrigins.production}/visual-fixtures/public-shell`)

  const opener = page.getByRole('button', { name: '打开目录' })
  await opener.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: '关闭目录', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await expect(opener).toBeFocused()
})

test('empty public preview keeps zero counts and a clear library entry', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(visualFixture.fixedNow) })
  await page.goto(
    `${visualOrigins.production}/visual-fixtures/public-preview-empty`,
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /把零散的知识/,
    }),
  ).toBeVisible()
  await expect(page.getByText('0 个分类')).toBeVisible()
  await expect(page.getByText('0 篇公开章节')).toBeVisible()
  await expect(page.getByText('开始整理你的知识')).toBeVisible()
  await expect(
    page.getByRole('link', { name: '进入笔记库' }).first(),
  ).toBeVisible()
})

test('empty library index explains how content will appear', async ({
  page,
}) => {
  await page.goto(
    `${visualOrigins.production}/visual-fixtures/library-index-empty`,
  )
  await expect(
    page.getByRole('heading', { name: '笔记库还是空的' }),
  ).toBeVisible()
  await expect(
    page.getByText('站主创建并发布第一个分类和章节后，会在这里出现。'),
  ).toBeVisible()
})

for (const visualCase of visualCases) {
  for (const viewport of visualViewports) {
    if (
      visualCase.viewports &&
      !visualCase.viewports.includes(viewport.name)
    ) {
      continue
    }
    for (const themeMode of ['light', 'dark'] as const) {
      test(`${visualCase.id} ${viewport.name} ${themeMode}`, async ({
        browser,
      }) => {
        const outputDirectory = path.join(
          artifactRoot,
          visualCase.id,
          viewport.name,
          themeMode,
        )
        await mkdir(outputDirectory, { recursive: true })
        const prototypePath = path.join(
          outputDirectory,
          'prototype.png',
        )
        const productionPath = path.join(
          outputDirectory,
          'production.png',
        )
        const diffPath = path.join(outputDirectory, 'diff.png')
        const reportPath = path.join(outputDirectory, 'report.json')

        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: themeMode,
          extraHTTPHeaders: { 'x-real-ip': '120.24.78.68' },
        })
        const prototypePage = await context.newPage()
        await preparePage(prototypePage, visualCase.productionLogin, themeMode)
        await prototypePage.goto(
          `${visualOrigins.prototype}${visualCase.prototypePath}`,
        )
        if (visualCase.overlay === 'design-tokens') {
          await applyDesignTokenSample(prototypePage)
        }
        if (visualCase.interaction) {
          await applyVisualInteraction(
            prototypePage,
            visualCase.interaction,
            visualCase.searchQuery,
          )
        }
        if (visualCase.expectedText) {
          await expect(
            prototypePage.getByText(visualCase.expectedText, {
              exact: true,
            }),
          ).toBeVisible()
        }
        await settle(prototypePage)
        await applyTheme(prototypePage, themeMode)
        const prototypePng = await prototypePage.screenshot({
          path: prototypePath,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          mask: masks(prototypePage, visualCase.maskSelectors),
          maskColor: '#d8d8d8',
        })

        const productionPage = await context.newPage()
        await prepareProductionPage(
          productionPage,
          visualCase.productionLogin,
          visualCase.productionPath,
          themeMode,
        )
        if (visualCase.overlay === 'design-tokens') {
          await applyDesignTokenSample(productionPage)
        }
        if (visualCase.interaction) {
          await applyVisualInteraction(
            productionPage,
            visualCase.interaction,
            visualCase.searchQuery,
          )
        }
        if (visualCase.expectedText) {
          await expect(
            productionPage.getByText(visualCase.expectedText, {
              exact: true,
            }),
          ).toBeVisible()
        }
        await settle(productionPage)
        await applyTheme(productionPage, themeMode)
        const productionPng = await productionPage.screenshot({
          path: productionPath,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          mask: masks(productionPage, visualCase.maskSelectors),
          maskColor: '#d8d8d8',
        })
        await context.close()

        try {
          const comparison = await compareVisualScreenshots(
            prototypePng,
            productionPng,
          )
          await writeFile(diffPath, comparison.diffPng)
          await writeFile(
            reportPath,
            JSON.stringify(
              {
                ticket: process.env.VISUAL_TICKET ?? '01',
                case: visualCase.id,
                viewport,
                themeMode,
                prototypePath,
                productionPath,
                diffPath,
                ...comparison,
                diffPng: undefined,
              },
              null,
              2,
            ),
          )
          if (enforce) {
            expect(comparison.diffRatio).toBeLessThanOrEqual(tolerance)
          }
        } catch (error) {
          await writeFile(
            reportPath,
            JSON.stringify(
              {
                ticket: process.env.VISUAL_TICKET ?? '01',
                case: visualCase.id,
                viewport,
                themeMode,
                prototypePath,
                productionPath,
                error:
                  error instanceof Error ? error.message : String(error),
              },
              null,
              2,
            ),
          )
          if (enforce) throw error
        }
      })
    }
  }
}
