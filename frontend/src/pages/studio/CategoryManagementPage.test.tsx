import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSiteStore } from '../../store/siteStore'
import { CategoryManagementPage } from './CategoryManagementPage'

const initialState = useSiteStore.getState()
const baseline = {
  categories: structuredClone(initialState.categories),
  notes: structuredClone(initialState.notes),
}

function orderedCategoryIds() {
  return useSiteStore
    .getState()
    .categories.slice()
    .sort((left, right) => left.order - right.order)
    .map((category) => category.id)
}

describe('CategoryManagementPage', () => {
  beforeEach(() => {
    useSiteStore.setState(structuredClone(baseline))
  })

  it('only saves a dragged category order after pressing save', () => {
    render(<CategoryManagementPage />)

    const initialOrder = orderedCategoryIds()
    const [firstId, secondId] = initialOrder
    const first = useSiteStore
      .getState()
      .categories.find((category) => category.id === firstId)
    const second = useSiteStore
      .getState()
      .categories.find((category) => category.id === secondId)
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    if (!first || !second) return

    expect(screen.queryAllByLabelText('上移分类')).toHaveLength(0)
    expect(screen.queryAllByLabelText('下移分类')).toHaveLength(0)

    const dataTransfer = {
      effectAllowed: '',
      getData: vi.fn(() => first.id),
      setData: vi.fn(),
    } as unknown as DataTransfer
    fireEvent.dragStart(
      screen.getByRole('button', { name: `拖拽分类：${first.title}` }),
      { dataTransfer },
    )
    fireEvent.dragOver(screen.getByLabelText(`分类：${second.title}`), {
      dataTransfer,
    })
    fireEvent.drop(screen.getByLabelText(`分类：${second.title}`), {
      dataTransfer,
    })

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
        .slice(0, 2),
    ).toEqual([second.title, first.title])
    expect(orderedCategoryIds()).toEqual(initialOrder)

    fireEvent.click(screen.getByRole('button', { name: '保存排序' }))

    expect(orderedCategoryIds().slice(0, 2)).toEqual([second.id, first.id])
  })
})
