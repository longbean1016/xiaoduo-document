import { PublicLibraryShell } from '@/components/public-library-shell'
import { listPublicLibrary } from '@/lib/public-library'

export const dynamic = 'force-dynamic'

export default async function SearchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <PublicLibraryShell categories={await listPublicLibrary()}>
      {children}
    </PublicLibraryShell>
  )
}
