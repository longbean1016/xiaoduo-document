import type { RootContent } from 'hast'
import type { ReactNode } from 'react'
import { MermaidDiagram } from '@/components/mermaid-diagram'
import { lowlight } from '@/lib/code-highlight'

function normalizeLanguage(language: string) {
  return language.trim().toLowerCase().split(/\s+/)[0] || 'text'
}

function renderHighlightedNode(node: RootContent, key: string): ReactNode {
  if (node.type === 'text') return node.value
  if (node.type !== 'element') return null

  const className = Array.isArray(node.properties?.className)
    ? node.properties.className.join(' ')
    : undefined
  return (
    <span key={key} className={className}>
      {node.children.map((child, index) =>
        renderHighlightedNode(child, `${key}-${index}`),
      )}
    </span>
  )
}

function highlightedCode(code: string, language: string) {
  if (!lowlight.registered(language)) return code
  try {
    return lowlight
      .highlight(language, code)
      .children.map((node, index) =>
        renderHighlightedNode(node, `token-${index}`),
      )
  } catch {
    return code
  }
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

  const languageClass =
    normalized.replace(/[^a-z0-9_-]/g, '') || 'text'
  return (
    <div
      className="markdown-code-block"
      data-language={normalized}
    >
      <div className="markdown-code-block-header">{normalized}</div>
      <pre>
        <code className={`hljs language-${languageClass}`}>
          {highlightedCode(code, normalized)}
        </code>
      </pre>
    </div>
  )
}
