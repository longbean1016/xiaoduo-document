// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandMark } from '@/components/brand-mark'

describe('BrandMark', () => {
  it('uses the library name without the legacy Zhijian lockup', () => {
    render(<BrandMark />)

    expect(screen.getByText('小多笔记库')).toBeInTheDocument()
    expect(screen.queryByText('知笺')).not.toBeInTheDocument()
    expect(screen.queryByText('Zhijian')).not.toBeInTheDocument()
  })

  it('uses the writing desk label when requested', () => {
    render(<BrandMark label="写作台" />)

    expect(screen.getByText('写作台')).toBeInTheDocument()
  })
})
