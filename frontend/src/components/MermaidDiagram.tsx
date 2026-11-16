import { useEffect, useId, useState } from 'react'

type DiagramState =
  | { status: 'loading'; svg: string; error: string }
  | { status: 'ready'; svg: string; error: string }
  | { status: 'error'; svg: string; error: string }

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'neutral'
}

export function MermaidDiagram({
  chart,
  ariaLabel = 'Mermaid 图表',
}: {
  chart: string
  ariaLabel?: string
}) {
  const reactId = useId().replace(/:/g, '')
  const [theme, setTheme] = useState<'neutral' | 'dark'>(() =>
    typeof document === 'undefined' ? 'neutral' : currentTheme(),
  )
  const [state, setState] = useState<DiagramState>({
    status: 'loading',
    svg: '',
    error: '',
  })

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function render() {
      const source = chart.trim()
      if (!source) {
        setState({
          status: 'error',
          svg: '',
          error: 'Mermaid 源码为空。',
        })
        return
      }
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme,
          fontFamily: 'inherit',
        })
        const result = await mermaid.render(
          `zhijian-mermaid-${reactId}`,
          source,
        )
        if (!cancelled) {
          setState({ status: 'ready', svg: result.svg, error: '' })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            svg: '',
            error:
              error instanceof Error
                ? error.message
                : 'Mermaid 图表渲染失败。',
          })
        }
      }
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [chart, reactId, theme])

  return (
    <div
      className={`mermaid-diagram is-${state.status}`}
      aria-label={ariaLabel}
      aria-busy={state.status === 'loading'}
    >
      {state.status === 'ready' ? (
        <div
          className="mermaid-diagram-canvas"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      ) : state.status === 'loading' ? (
        <p className="mermaid-diagram-status">正在生成图表…</p>
      ) : (
        <div className="mermaid-diagram-error" role="alert">
          <strong>图表渲染失败</strong>
          <p>{state.error}</p>
          <pre>{chart}</pre>
        </div>
      )}
    </div>
  )
}
