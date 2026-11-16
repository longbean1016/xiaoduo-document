import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('copy failed')
}

export function CodeCopyButton({
  code,
  className,
}: {
  code: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    buttonRef.current?.setAttribute('data-copy-ready', 'true')
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
      }
    }
  }, [])

  async function copyCode() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        fallbackCopy(code)
      }
    } catch {
      try {
        fallbackCopy(code)
      } catch {
        return
      }
    }

    setCopied(true)
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current)
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      resetTimerRef.current = null
    }, 1600)
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn('code-copy-button', copied && 'is-copied', className)}
      aria-label={copied ? 'Copied' : '复制代码'}
      title={copied ? 'Copied' : '复制代码'}
      data-copied={copied ? 'true' : 'false'}
      data-copy-ready="false"
      onClick={() => void copyCode()}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">{copied ? 'Copied' : '复制'}</span>
    </button>
  )
}
