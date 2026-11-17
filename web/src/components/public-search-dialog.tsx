'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import {
  ArrowRight,
  FileText,
  Layers3,
  Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import type { PublicCategory } from '@/lib/public-library'

export function PublicSearchDialog({
  open,
  onOpenChange,
  categories,
  returnFocusTo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: PublicCategory[]
  returnFocusTo?: RefObject<HTMLElement | null>
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const router = useRouter()

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const matchedCategories = categories.filter(
      (category) =>
        !normalized || category.title.toLowerCase().includes(normalized),
    )
    const matchedNotes = categories
      .flatMap((category) =>
        category.chapters.map((chapter) => ({ category, chapter })),
      )
      .filter(
        ({ chapter }) =>
          !normalized ||
          chapter.title.toLowerCase().includes(normalized) ||
          chapter.plainText.toLowerCase().includes(normalized),
      )
      .sort((left, right) =>
        right.chapter.publishedAt.localeCompare(
          left.chapter.publishedAt,
        ),
      )
      .slice(0, 7)
    return {
      categories: matchedCategories.slice(0, 4),
      notes: matchedNotes,
    }
  }, [categories, query])

  useEffect(() => {
    if (!open) return
    if (returnFocusTo?.current) {
      returnFocusRef.current = returnFocusTo.current
    } else if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open, returnFocusTo])

  function go(path: string) {
    onOpenChange(false)
    router.push(path)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = query.trim()
    if (!normalized) return
    go(`/search?q=${encodeURIComponent(normalized)}`)
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setQuery('')
        onOpenChange(nextOpen)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-[90] bg-[#121a16]/52 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          className="dialog-content search-dialog fixed left-1/2 top-[14vh] z-[91] w-[min(92vw,680px)] -translate-x-1/2 overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--paper)] shadow-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus()
            returnFocusRef.current = null
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            搜索小多笔记
          </DialogPrimitive.Title>
          <form
            role="search"
            className="flex h-15 items-center gap-3 border-b border-[var(--line)] px-5"
            onSubmit={submit}
          >
            <Search size={22} className="text-[var(--muted)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索公开章节"
              placeholder="搜索分类或章节"
              className="h-full flex-1 border-0 bg-transparent text-[18px] text-[var(--ink)] outline-none placeholder:text-[var(--muted-faint)]"
            />
            <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--muted-faint)]">
              ESC
            </span>
          </form>

          <div className="max-h-[64vh] overflow-y-auto px-3 py-3">
            {results.categories.length ? (
              <SearchSection label="分类">
                {results.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className="search-result-row"
                    data-visual-dynamic
                    onClick={() => go(`/library/${category.slug}`)}
                  >
                    <span className="search-result-icon">
                      <Layers3 size={19} />
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--ink)]">
                      {category.title}
                    </span>
                    <ArrowRight
                      size={18}
                      className="text-[var(--muted-faint)]"
                    />
                  </button>
                ))}
              </SearchSection>
            ) : null}

            {results.notes.length ? (
              <SearchSection label="章节">
                {results.notes.map(({ category, chapter }) => (
                  <button
                    key={chapter.articleId}
                    type="button"
                    className="search-result-row"
                    onClick={() =>
                      go(
                        `/library/${category.slug}/${chapter.path}`,
                      )
                    }
                  >
                    <span className="search-result-icon">
                      <FileText size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                        {chapter.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs leading-5 text-[var(--muted)]">
                        {chapter.plainText.slice(0, 110)}
                      </span>
                    </span>
                    <ArrowRight
                      size={18}
                      className="text-[var(--muted-faint)]"
                    />
                  </button>
                ))}
              </SearchSection>
            ) : null}

            {!results.notes.length && !results.categories.length ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <p className="font-display text-xl text-[var(--ink)]">
                  没有找到相关内容
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  试试更短的词。
                </p>
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function SearchSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section className="mb-3 last:mb-0">
      <p className="px-2 pb-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--muted-faint)]">
        {label}
      </p>
      <div>{children}</div>
    </section>
  )
}
