import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '小多写作台',
}

export default function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
