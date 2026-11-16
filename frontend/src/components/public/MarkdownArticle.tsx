import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import {
  Children,
  isValidElement,
  type ReactNode,
} from 'react'
import { MarkdownCodeBlock } from './MarkdownCodeBlock'

const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u', 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ['style', /^color:\s*#[0-9a-f]{3,8}$/i],
    ],
    mark: [
      ...(defaultSchema.attributes?.mark ?? []),
      ['style', /^background-color:\s*#[0-9a-f]{3,8}$/i],
    ],
  },
}

function childText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child)
      }
      if (isValidElement<{ children?: ReactNode }>(child)) {
        return childText(child.props.children)
      }
      return ''
    })
    .join('')
}

export function MarkdownArticle({ markdown }: { markdown: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, markdownSanitizeSchema],
          rehypeSlug,
        ]}
        components={{
          pre: ({ children }) => {
            const child = Children.toArray(children)[0]
            if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) {
              return <pre>{children}</pre>
            }
            const language =
              child.props.className?.match(/language-([^\s]+)/)?.[1] ?? 'text'
            return (
              <MarkdownCodeBlock
                language={language}
                code={childText(child.props.children).replace(/\n$/, '')}
              />
            )
          },
          code: ({ children, className }) => (
            <code className={className}>{children}</code>
          ),
          a: ({ href, children, ...props }) => {
            const external = href?.startsWith('http')
            return (
              <a
                href={href}
                {...(external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                {...props}
              >
                {children}
              </a>
            )
          },
          img: ({ src, alt }) => (
            <img src={src} alt={alt ?? ''} loading="lazy" />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
