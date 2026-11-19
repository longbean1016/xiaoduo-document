import { PublicLibraryShell } from '@/components/public-library-shell'
import {
  getPublicSiteProfile,
  listPublicLibrary,
} from '@/lib/public-library'

export const dynamic = 'force-dynamic'

export default async function SearchLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [library, profile] = await Promise.all([
    listPublicLibrary(),
    getPublicSiteProfile(),
  ])

  return (
    <PublicLibraryShell
      categories={library}
      avatarUrl={profile?.avatarUrl}
    >
      {children}
    </PublicLibraryShell>
  )
}
