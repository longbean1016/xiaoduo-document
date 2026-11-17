'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type {
  PublicCategory,
  PublicSiteProfile,
} from '@/lib/public-library'

function formatSceneTime(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month} / ${day} · ${hours}:${minutes}`
}

export function PublicPreview({
  profile,
}: {
  profile: PublicSiteProfile | null
  categories: PublicCategory[]
}) {
  const ownerName = profile?.authorName ?? '小多'
  const [sceneTime, setSceneTime] = useState('-- / -- · --:--')

  useEffect(() => {
    const updateTime = () => setSceneTime(formatSceneTime(new Date()))
    updateTime()
    const timer = window.setInterval(updateTime, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <main className="coast-landing">
      <div className="coast-landing-scene" aria-hidden="true">
        <div className="coast-landing-layer">
          <div className="coast-landing-image">
            <Image
              src="/xiaoduo-coast.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              draggable={false}
            />
          </div>
        </div>
        <span className="coast-landing-shade" />
        <span className="coast-landing-light" />
        <span className="coast-landing-horizon" />
        <span className="coast-landing-grain" />
        <span className="coast-landing-mist" />
        <div className="coast-landing-particles">
          {Array.from({ length: 18 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <div className="coast-landing-sparkles">
          {Array.from({ length: 14 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      </div>

      <section className="coast-landing-hero">
        <div className="coast-landing-copy">
          <p className="coast-landing-eyebrow coast-landing-reveal-1">
            <span aria-hidden="true" />
            {ownerName}个人笔记
          </p>

          <h1 className="coast-landing-reveal-2">
            <span>一片海，</span>
            <span>几分牵挂。</span>
          </h1>

          <p className="coast-landing-lede coast-landing-reveal-3">
            路上的风景、读过的句子，和偶尔牵挂的人。
          </p>
        </div>

        <div
          className="coast-landing-caption coast-landing-reveal-4"
          aria-hidden="true"
        >
          <span />
          <time>{sceneTime}</time>
        </div>

        <Link
          href="/library"
          className="coast-landing-cta coast-landing-reveal-5"
        >
          进入笔记库
          <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </main>
  )
}
