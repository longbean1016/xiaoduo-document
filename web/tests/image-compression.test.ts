import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressAvatarForUpload } from '@/lib/image-compression'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('avatar compression', () => {
  it('normalizes a landscape image to a 512px square', async () => {
    const drawImage = vi.fn()
    const close = vi.fn()
    const bitmap = { width: 1260, height: 706, close }
    const context = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage,
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn(
        (callback: BlobCallback, type?: string) => {
          callback(new Blob(['avatar'], { type }))
        },
      ),
    }

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    )
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    })

    const file = new File(['source'], 'avatar.jpg', {
      type: 'image/jpeg',
    })
    const compressed = await compressAvatarForUpload(file)

    expect(canvas.width).toBe(512)
    expect(canvas.height).toBe(512)
    expect(context.imageSmoothingEnabled).toBe(true)
    expect(context.imageSmoothingQuality).toBe('high')
    expect(drawImage).toHaveBeenCalledWith(
      bitmap,
      277,
      0,
      706,
      706,
      0,
      0,
      512,
      512,
    )
    expect(canvas.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/webp',
      0.9,
    )
    expect(compressed.contentType).toBe('image/webp')
    expect(close).toHaveBeenCalledOnce()
  })
})
