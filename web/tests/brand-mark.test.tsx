// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandMark } from '@/components/brand-mark'

describe('BrandMark', () => {
  it('uses the Xiaoduo name and round portrait mark', () => {
    const { container } = render(<BrandMark />)

    expect(screen.getByText('小多')).toBeInTheDocument()
    expect(screen.queryByText('知笺')).not.toBeInTheDocument()
    expect(screen.queryByText('Zhijian')).not.toBeInTheDocument()
    expect(
      container.querySelector('img[src*="xiaoduo-mark.jpg"]'),
    ).toBeInTheDocument()
  })

  it('uses the writing desk label when requested', () => {
    render(<BrandMark label="写作台" />)

    expect(screen.getByText('写作台')).toBeInTheDocument()
  })
})
