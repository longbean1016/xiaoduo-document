import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react'
import { Check, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MermaidDiagram } from '../MermaidDiagram'
import {
  codeLanguageLabel,
  codeLanguageOptions,
} from '../../lib/codeHighlight'
import { cn } from '../../lib/utils'

export function CodeBlockView({
  node,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const language =
    typeof node.attrs.language === 'string' && node.attrs.language
      ? node.attrs.language
      : 'plaintext'
  const isMermaid = language === 'mermaid'
  const [sourceMode, setSourceMode] = useState({
    language,
    showSource: !isMermaid,
  })
  const showSource =
    sourceMode.language === language
      ? sourceMode.showSource
      : !isMermaid

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
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="editor-code-language-trigger"
              aria-label="代码语言"
            >
              <span>{codeLanguageLabel(language)}</span>
              <ChevronDown size={15} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="block-type-menu"
              side="bottom"
              align="start"
              sideOffset={6}
            >
              <DropdownMenu.Label className="block-type-menu-label">
                代码语言
              </DropdownMenu.Label>
              {codeLanguageOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.value}
                  className={cn(
                    'block-type-menu-item',
                    language === option.value && 'is-active',
                  )}
                  onSelect={() =>
                    updateAttributes({ language: option.value })
                  }
                >
                  <span>{option.label}</span>
                  {language === option.value ? (
                    <Check size={17} className="ml-auto" />
                  ) : null}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
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
      </div>

      <div className={cn(!showSource && 'editor-code-block-source-hidden')}>
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
