'use client'

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { CodeCopyButton } from '@/components/code-copy-button'
import { MermaidDiagram } from '@/components/mermaid-diagram'
import { cn } from '@/lib/utils'

export function CodeBlockView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const language =
    typeof node.attrs.language === 'string' && node.attrs.language
      ? node.attrs.language
      : 'text'
  const isMermaid = language === 'mermaid'
  const [languageEdit, setLanguageEdit] = useState({
    nodeLanguage: language,
    value: language,
  })
  const languageValue =
    languageEdit.nodeLanguage === language ? languageEdit.value : language
  const [sourceMode, setSourceMode] = useState({
    language,
    showSource: !isMermaid,
  })
  const showSource =
    sourceMode.language === language
      ? sourceMode.showSource
      : !isMermaid
  const lineCount = Math.max(1, node.textContent.split('\n').length)
  const copyCode = node.textContent.replace(/\r\n?/g, '\n')

  return (
    <NodeViewWrapper
      className={cn(
        'editor-code-block',
        selected && 'is-selected',
        isMermaid && 'is-mermaid',
      )}
      data-language={language}
    >
      <div className="editor-code-block-header" contentEditable={false}>
        <label className="editor-code-language-field">
          <span className="sr-only">代码语言</span>
          <input
            value={languageValue}
            aria-label="代码语言"
            spellCheck={false}
            onChange={(event) =>
              setLanguageEdit({
                nodeLanguage: language,
                value: event.target.value,
              })
            }
            onBlur={() => {
              const next = languageValue.trim().toLowerCase() || 'text'
              setLanguageEdit({ nodeLanguage: next, value: next })
              updateAttributes({ language: next })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                setLanguageEdit({
                  nodeLanguage: language,
                  value: language,
                })
                event.currentTarget.blur()
              }
            }}
          />
        </label>
        <div className="editor-code-block-actions">
          {isMermaid ? (
            <button
              type="button"
              onClick={() =>
                setSourceMode({
                  language,
                  showSource: !showSource,
                })
              }
              aria-label={showSource ? '显示图表' : '查看源码'}
              title={showSource ? '显示图表' : '查看源码'}
            >
              {showSource ? <Eye size={17} /> : <EyeOff size={17} />}
              {showSource ? '显示图表' : '查看源码'}
            </button>
          ) : null}
          <CodeCopyButton code={copyCode} />
        </div>
      </div>

      <div
        className={cn(
          'editor-code-block-body',
          !showSource && 'editor-code-block-source-hidden',
        )}
      >
        <div
          className="editor-code-line-numbers"
          contentEditable={false}
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <pre className="hljs">
          <NodeViewContent<'code'>
            as="code"
            className={`language-${language}`}
            spellCheck={false}
          />
        </pre>
      </div>

      {isMermaid && !showSource ? (
        <MermaidDiagram chart={node.textContent} />
      ) : null}
    </NodeViewWrapper>
  )
}
