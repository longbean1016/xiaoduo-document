'use client'

import { useEffect, useRef, useState } from 'react'
import { centerTocItem } from '@/lib/center-toc-item'
import type { MarkdownHeading } from '@/lib/markdown-headings'
import { cn } from '@/lib/utils'

export function ChapterToc({ headings }: { headings: MarkdownHeading[] }) {
  const tocRef = useRef<HTMLElement>(null)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(
    headings[0]?.id ?? null,
  )
  const minHeadingLevel = Math.min(
    ...headings.map((heading) => heading.level),
  )

  useEffect(() => {
    const scrollRoot = document.getElementById('library-content')
    if (!scrollRoot) return
    let frame = 0

    const update = () => {
      let current = headings[0]?.id ?? null
      const threshold =
        scrollRoot.getBoundingClientRect().top +
        Math.min(360, scrollRoot.clientHeight * 0.42)
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= threshold) {
          current = heading.id
        }
      }
      if (
        scrollRoot.scrollTop + scrollRoot.clientHeight >=
        scrollRoot.scrollHeight - 4
      ) {
        current = headings.at(-1)?.id ?? current
      }
      setActiveHeadingId(current)
    }

    const onScroll = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(update)
    }

    update()
    scrollRoot.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      scrollRoot.removeEventListener('scroll', onScroll)
    }
  }, [headings])

  useEffect(() => {
    const toc = tocRef.current
    if (!toc || !activeHeadingId) return
    const active = toc.querySelector<HTMLElement>(
      'a[aria-current="location"]',
    )
    if (!active) return

    centerTocItem(toc, active)
  }, [activeHeadingId])

  return (
    <aside ref={tocRef} className="chapter-toc" aria-label="本章目录">
      <p className="section-kicker">On this page</p>
      <nav>
        {headings.map((heading) => (
          <a
            key={heading.id}
            href={`#${heading.id}`}
            className={cn(
              heading.level === minHeadingLevel && 'is-top-level',
              activeHeadingId === heading.id && 'is-current',
            )}
            data-level={heading.level}
            style={{
              paddingLeft: `${(heading.level - minHeadingLevel) * 16}px`,
            }}
            aria-current={
              activeHeadingId === heading.id ? 'location' : undefined
            }
            onClick={() => setActiveHeadingId(heading.id)}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  )
}
