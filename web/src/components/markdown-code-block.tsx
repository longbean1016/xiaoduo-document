import type { RootContent } from 'hast'
import type { ReactNode } from 'react'
import { CodeCopyButton } from '@/components/code-copy-button'
import { MermaidDiagram } from '@/components/mermaid-diagram'
import { lowlight } from '@/lib/code-highlight'

type HighlightToken = {
  className?: string
  text: string
}

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase().split(/\s+/)[0] || 'text'
}

function flattenHighlightedNode(
  node: RootContent,
  parentClassNames: string[] = [],
): HighlightToken[] {
  if (node.type === 'text') {
    return [
      {
        className: parentClassNames.join(' ') || undefined,
        text: node.value,
      },
    ]
  }
  if (node.type !== 'element') return []

  const ownClassNames = Array.isArray(node.properties?.className)
    ? node.properties.className.map(String)
    : []
  const classNames = [...parentClassNames, ...ownClassNames]
  return node.children.flatMap((child) =>
    flattenHighlightedNode(child, classNames),
  )
}

function highlightedTokens(code: string, language: string) {
  if (!lowlight.registered(language)) return [{ text: code }]
  try {
    return lowlight
      .highlight(language, code)
      .children.flatMap((node) => flattenHighlightedNode(node))
  } catch {
    return [{ text: code }]
  }
}

function highlightedLines(code: string, language: string) {
  const lines: ReactNode[][] = [[]]
  highlightedTokens(code, language).forEach((token, tokenIndex) => {
    token.text.split('\n').forEach((part, partIndex) => {
      if (partIndex > 0) lines.push([])
      if (!part) return
      lines.at(-1)?.push(
        <span
          key={`${tokenIndex}-${partIndex}`}
          className={token.className}
        >
          {part}
        </span>,
      )
    })
  })
  return lines
}

function codeLanguageClass(language: string) {
  return language.replace(/[^a-z0-9_-]/g, '') || 'text'
}

function MarkdownCodeText({
  code,
  language,
}: {
  code: string
  language: string
}) {
  const lines = highlightedLines(code.replace(/\n+$/, ''), language)
  return (
    <code className={`hljs language-${codeLanguageClass(language)}`}>
      {lines.map((line, index) => (
        <span
          key={index}
          className="markdown-code-line"
          data-line={index + 1}
        >
          <span className="markdown-code-line-content">{line}</span>
        </span>
      ))}
    </code>
  )
}

export function MarkdownCodeBlock({
  code,
  language,
}: {
  code: string
  language: string
}) {
  const normalized = normalizeLanguage(language)
  if (normalized === 'mermaid') {
    return <MermaidDiagram chart={code} />
  }
  const copyCode = code.replace(/\r\n?/g, '\n').replace(/\n+$/, '')

  return (
    <div
      className="markdown-code-block"
      data-language={normalized}
    >
      <div className="markdown-code-block-header">
        <span>{normalized}</span>
        <CodeCopyButton code={copyCode} />
      </div>
      <pre>
        <MarkdownCodeText code={code} language={normalized} />
      </pre>
    </div>
  )
}
