'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronUp, Palette } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'zhijian-studio-surface'
const CHANGE_EVENT = 'zhijian-studio-surface-change'

const surfaces = [
  { value: 'default', label: '默认白', color: '#ffffff' },
  { value: 'warm', label: '暖米黄', color: '#fbf6e7' },
  { value: 'green', label: '浅豆绿', color: '#edf6ee' },
  { value: 'blue', label: '雾青蓝', color: '#eef5f7' },
] as const

export type StudioSurface = (typeof surfaces)[number]['value']

function isSurface(value: string | null): value is StudioSurface {
  return surfaces.some((surface) => surface.value === value)
}

function getSnapshot(): StudioSurface {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isSurface(value) ? value : 'default'
  } catch {
    return 'default'
  }
}

function getServerSnapshot(): StudioSurface {
  return 'default'
}

function subscribe(callback: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback()
  }
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', handleStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', handleStorage)
  }
}

function setSurface(value: StudioSurface) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    return
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function useStudioSurface(): StudioSurface {
  const surface = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  useEffect(() => {
    const root = document.documentElement
    root.dataset.studioSurface = surface
    return () => {
      if (root.dataset.studioSurface === surface) {
        delete root.dataset.studioSurface
      }
    }
  }, [surface])

  return surface
}

export function StudioSurfacePicker() {
  const surface = useStudioSurface()
  const selected =
    surfaces.find((option) => option.value === surface) ?? surfaces[0]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="studio-surface-trigger"
          aria-label={`背景色：${selected.label}`}
        >
          <Palette size={17} />
          <span>护眼背景</span>
          <span
            className="studio-surface-swatch"
            style={{ backgroundColor: selected.color }}
            aria-hidden="true"
          />
          <ChevronUp size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="studio-surface-menu"
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
        >
          <div className="studio-surface-menu-title">护眼背景</div>
          <DropdownMenu.RadioGroup
            value={surface}
            onValueChange={(value) => {
              if (isSurface(value)) setSurface(value)
            }}
          >
            {surfaces.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className={cn(
                  'studio-surface-option',
                  option.value === surface && 'is-active',
                )}
              >
                <span
                  className="studio-surface-swatch"
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
                <span>{option.label}</span>
                {option.value === surface ? <Check size={16} /> : null}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <p className="studio-surface-menu-hint">
            会调整整个写作台界面，不影响公开站。
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
