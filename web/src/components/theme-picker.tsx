'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Moon, Sun } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'zhijian-theme-surface'
const LEGACY_SURFACE_KEY = 'zhijian-studio-surface'
const LEGACY_THEME_KEY = 'zhijian-theme'
const CHANGE_EVENT = 'zhijian-theme-surface-change'

const options = [
  { value: 'default', label: '默认白', color: '#ffffff' },
  { value: 'warm', label: '暖米黄', color: '#fbf6e7' },
  { value: 'green', label: '浅豆绿', color: '#edf6ee' },
  { value: 'blue', label: '雾青蓝', color: '#eef5f7' },
  { value: 'dark', label: '深色', color: '#151515' },
] as const

type ThemeSurface = (typeof options)[number]['value']

function isThemeSurface(value: string | null): value is ThemeSurface {
  return options.some((option) => option.value === value)
}

function getSnapshot(): ThemeSurface {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isThemeSurface(stored)) return stored
    if (window.localStorage.getItem(LEGACY_THEME_KEY) === 'dark') {
      return 'dark'
    }
    const legacySurface = window.localStorage.getItem(LEGACY_SURFACE_KEY)
    if (isThemeSurface(legacySurface) && legacySurface !== 'dark') {
      return legacySurface
    }
  } catch {
    // Fall through to the default theme.
  }
  return 'default'
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('zhijian-theme-change', callback)
  window.addEventListener('zhijian-studio-surface-change', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('zhijian-theme-change', callback)
    window.removeEventListener('zhijian-studio-surface-change', callback)
    window.removeEventListener('storage', callback)
  }
}

function applyThemeSurface(value: ThemeSurface) {
  const theme = value === 'dark' ? 'dark' : 'light'
  const surface = value === 'dark' ? 'default' : value
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.themeSurface = surface
  root.style.colorScheme = theme
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
    window.localStorage.setItem(LEGACY_THEME_KEY, theme)
    window.localStorage.setItem(LEGACY_SURFACE_KEY, surface)
  } catch {
    // The theme still applies for the current page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
  window.dispatchEvent(new Event('zhijian-theme-change'))
  window.dispatchEvent(new Event('zhijian-studio-surface-change'))
}

export function ThemePicker({
  className,
  iconSize = 17,
}: {
  className?: string
  iconSize?: number
}) {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => 'default')
  const selected =
    options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    const current = getSnapshot()
    const root = document.documentElement
    root.dataset.theme = current === 'dark' ? 'dark' : 'light'
    root.dataset.themeSurface =
      current === 'dark' ? 'default' : current
    root.style.colorScheme = current === 'dark' ? 'dark' : 'light'
  }, [value])

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn('theme-toggle', className)}
          aria-label={`主题与护眼背景：${selected.label}`}
          title={`主题与护眼背景：${selected.label}`}
        >
          {value === 'dark' ? (
            <Sun aria-hidden="true" size={iconSize} />
          ) : (
            <Moon aria-hidden="true" size={iconSize} />
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="theme-picker-menu"
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <DropdownMenu.Label className="theme-picker-title">
            主题与护眼背景
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(next) => {
              if (isThemeSurface(next)) applyThemeSurface(next)
            }}
          >
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className={cn(
                  'theme-picker-option',
                  option.value === value && 'is-active',
                )}
              >
                <span
                  className="theme-picker-swatch"
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
                <span>{option.label}</span>
                {option.value === value ? <Check size={16} /> : null}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <p className="theme-picker-hint">
            阅读页与写作台共用同一套主题。
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
