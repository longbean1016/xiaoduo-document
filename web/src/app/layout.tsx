import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100',
  ),
  title: '小多笔记',
  description: '由站主长期维护的公开知识书',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{const t=localStorage.getItem('zhijian-theme');if(t==='dark'){document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark'}}catch{}",
          }}
        />
        {children}
      </body>
    </html>
  )
}
