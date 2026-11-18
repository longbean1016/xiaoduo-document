import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

async function read(relative: string) {
  return readFile(path.join(process.cwd(), relative), 'utf8')
}

describe('production deployment configuration', () => {
  it('defines the required single-host services and trusted proxy topology', async () => {
    const compose = await read('docker-compose.yml')
    expect(compose).toContain('  web:')
    expect(compose).toContain('  mysql:')
    expect(compose).toContain('  nginx:')
    expect(compose).toContain('  cron:')
    const mysqlBlock = compose.split('  mysql:')[1]?.split(/\n  \w+:/)[0]
    expect(mysqlBlock).not.toContain('ports:')

    const nginx = await read('deploy/nginx.conf')
    expect(nginx).toContain('listen 443 ssl')
    expect(nginx).toContain('proxy_set_header X-Real-IP $remote_addr;')
    expect(nginx).toContain('proxy_pass http://web:3000;')

    const dockerfile = await read('Dockerfile')
    expect(dockerfile).toContain(
      'COPY --from=builder --chown=nextjs:nodejs /app/public ./public',
    )
  })

  it('documents the accepted no-backup and no-versioning risk', async () => {
    const deployment = await read('DEPLOYMENT.md')
    expect(deployment).toContain('不包含自动数据库备份')
    expect(deployment).toContain('不启用 OSS 版本控制')
    expect(deployment).toContain('cron')
    expect(deployment).toContain('health')
  })

  it('renders the database-backed public home page at request time', async () => {
    const homePage = await read('src/app/page.tsx')
    expect(homePage).toContain(
      "export const dynamic = 'force-dynamic'",
    )
  })

  it('renders the database-backed search route at request time', async () => {
    const searchLayout = await read('src/app/search/layout.tsx')
    expect(searchLayout).toContain(
      "export const dynamic = 'force-dynamic'",
    )
  })
})
