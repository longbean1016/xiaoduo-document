import { ImageResponse } from 'next/og'
import {
  getPublicChapterByPath,
  getPublicSiteProfile,
} from '@/lib/public-library'
import { toReaderDiscoveryEntry } from '@/server/reader-discovery'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ categorySlug: string; chapterPath: string }>
}) {
  const { categorySlug, chapterPath } = await params
  const chapter = await getPublicChapterByPath(
    decodeURIComponent(categorySlug),
    decodeURIComponent(chapterPath),
  )
  if (!chapter) return new Response('Not found', { status: 404 })
  const profile = await getPublicSiteProfile()
  const entry = toReaderDiscoveryEntry(chapter)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '64px',
          background: '#f7f4ed',
          color: '#24221e',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: entry.previewImage ? '62%' : '100%',
          }}
        >
          <div
            style={{ display: 'flex', fontSize: 26, color: '#9b4c2f' }}
          >
            小多笔记 · {chapter.categoryTitle}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 64,
                lineHeight: 1.15,
              }}
            >
              {entry.title}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                color: '#6f6a60',
              }}
            >
              {entry.plainText.slice(0, 80)}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 26 }}>
            {`${profile?.authorName ?? entry.authorName}${
              entry.contributors.length
                ? ` · 贡献者 ${entry.contributors.join('、')}`
                : ''
            }`}
          </div>
        </div>
        {entry.previewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.previewImage}
            alt=""
            width="380"
            height="500"
            style={{
              width: 380,
              height: 500,
              marginLeft: 40,
              borderRadius: 12,
              objectFit: 'cover',
            }}
          />
        ) : null}
      </div>
    ),
    size,
  )
}
