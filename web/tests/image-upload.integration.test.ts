import { describe, expect, it } from 'vitest'
import {
  createImageUploadTarget,
  uploadProfileImage,
} from '@/server/image-upload'

describe('image upload', () => {
  it('creates a scoped short-lived upload target for a compressed image', async () => {
    const calls: Array<{
      objectKey: string
      contentType: string
      expires: number
    }> = []
    const target = await createImageUploadTarget(
      {
        articleId: 'article-1',
        contentType: 'image/webp',
        size: 1_200_000,
      },
      {
        publicBaseUrl: 'https://cdn.example.com',
        signer: {
          sign(input) {
            calls.push(input)
            return 'https://bucket.example.com/signed'
          },
        },
      },
    )

    expect(target.objectKey).toMatch(
      /^notes\/article-1\/[a-f0-9-]+\.webp$/,
    )
    expect(target).toMatchObject({
      uploadUrl: 'https://bucket.example.com/signed',
      publicUrl: `https://cdn.example.com/${target.objectKey}`,
      contentType: 'image/webp',
      expiresInSeconds: 600,
    })
    expect(calls).toEqual([
      {
        objectKey: target.objectKey,
        contentType: 'image/webp',
        expires: 600,
      },
    ])
  })

  it('rejects unsupported types and oversized compressed images', async () => {
    const signer = { sign: () => 'https://bucket.example.com/signed' }
    await expect(
      createImageUploadTarget(
        {
          articleId: 'article-1',
          contentType: 'image/gif',
          size: 100,
        },
        { publicBaseUrl: 'https://cdn.example.com', signer },
      ),
    ).rejects.toThrow('UNSUPPORTED_IMAGE_TYPE')
    await expect(
      createImageUploadTarget(
        {
          articleId: 'article-1',
          contentType: 'image/jpeg',
          size: 6 * 1024 * 1024 + 1,
        },
        { publicBaseUrl: 'https://cdn.example.com', signer },
      ),
    ).rejects.toThrow('IMAGE_TOO_LARGE')
  })

  it('uploads a profile avatar through the server without exposing OSS credentials', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const calls: Array<{
      objectKey: string
      contentType: string
      body: Uint8Array
    }> = []

    const upload = await uploadProfileImage(
      {
        userId: 'owner-1',
        file: new File([bytes], 'avatar.webp', { type: 'image/webp' }),
      },
      {
        publicBaseUrl: 'https://cdn.example.com/',
        uploader: {
          async put(input) {
            calls.push(input)
          },
        },
      },
    )

    expect(upload.objectKey).toMatch(
      /^profiles\/owner-1\/avatar\/[a-f0-9-]+\.webp$/,
    )
    expect(upload.publicUrl).toBe(
      `https://cdn.example.com/${upload.objectKey}`,
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      objectKey: upload.objectKey,
      contentType: 'image/webp',
    })
    expect(Buffer.from(calls[0].body)).toEqual(Buffer.from(bytes))
  })
})
