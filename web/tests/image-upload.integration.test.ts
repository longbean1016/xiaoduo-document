import { describe, expect, it } from 'vitest'
import {
  createImageUploadTarget,
  createProfileImageUploadTarget,
} from '@/server/image-upload'

describe('image upload signing', () => {
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

  it('scopes profile avatar uploads to the owner profile namespace', async () => {
    const target = await createProfileImageUploadTarget(
      {
        userId: 'owner-1',
        contentType: 'image/webp',
        size: 20_000,
      },
      {
        publicBaseUrl: 'https://cdn.example.com/',
        signer: {
          sign: () => 'https://bucket.example.com/profile-avatar',
        },
      },
    )

    expect(target.objectKey).toMatch(
      /^profiles\/owner-1\/avatar\/[a-f0-9-]+\.webp$/,
    )
    expect(target.publicUrl).toBe(
      `https://cdn.example.com/${target.objectKey}`,
    )
  })
})
