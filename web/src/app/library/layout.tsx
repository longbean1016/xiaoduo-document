import { PublicLibraryShell } from '@/components/public-library-shell'
import { listPublicLibrary } from '@/lib/public-library'

export const dynamic = 'force-dynamic'

export default async function LibraryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const library = await listPublicLibrary()
  return (
    <PublicLibraryShell categories={library}>
      {children}
    </PublicLibraryShell>
  )
}
