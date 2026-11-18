import { randomUUID } from 'node:crypto'
import OSS from 'ali-oss'

const UPLOAD_EXPIRES_SECONDS = 600
const MAX_COMPRESSED_IMAGE_BYTES = 6 * 1024 * 1024
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const

export type UploadableImageType = keyof typeof IMAGE_EXTENSIONS

export interface ImageUploadSigner {
  sign(input: {
    objectKey: string
    contentType: UploadableImageType
    expires: number
  }): string
}

export interface ImageUploadTarget {
  objectKey: string
  uploadUrl: string
  publicUrl: string
  contentType: UploadableImageType
  expiresInSeconds: number
}

async function createScopedImageUploadTarget(
  input: {
    contentType: string
    objectPrefix: string
    size: number
  },
  options: {
    signer: ImageUploadSigner
    publicBaseUrl: string
  },
): Promise<ImageUploadTarget> {
  if (!(input.contentType in IMAGE_EXTENSIONS)) {
    throw new Error('UNSUPPORTED_IMAGE_TYPE')
  }
  if (
    !Number.isFinite(input.size) ||
    input.size <= 0 ||
    input.size > MAX_COMPRESSED_IMAGE_BYTES
  ) {
    throw new Error('IMAGE_TOO_LARGE')
  }
  const contentType = input.contentType as UploadableImageType
  const objectKey = `${input.objectPrefix}/${randomUUID()}.${
    IMAGE_EXTENSIONS[contentType]
  }`
  return {
    objectKey,
    uploadUrl: options.signer.sign({
      objectKey,
      contentType,
      expires: UPLOAD_EXPIRES_SECONDS,
    }),
    publicUrl: `${options.publicBaseUrl.replace(/\/+$/, '')}/${objectKey}`,
    contentType,
    expiresInSeconds: UPLOAD_EXPIRES_SECONDS,
  }
}

export function createImageUploadTarget(
  input: {
    articleId: string
    contentType: string
    size: number
  },
  options: {
    signer: ImageUploadSigner
    publicBaseUrl: string
  },
) {
  return createScopedImageUploadTarget(
    {
      contentType: input.contentType,
      objectPrefix: `notes/${input.articleId}`,
      size: input.size,
    },
    options,
  )
}

export function createProfileImageUploadTarget(
  input: {
    userId: string
    contentType: string
    size: number
  },
  options: {
    signer: ImageUploadSigner
    publicBaseUrl: string
  },
) {
  return createScopedImageUploadTarget(
    {
      contentType: input.contentType,
      objectPrefix: `profiles/${input.userId}/avatar`,
      size: input.size,
    },
    options,
  )
}

export function createOssImageUploadConfiguration() {
  const bucket = process.env.OSS_BUCKET
  const endpoint = process.env.OSS_ENDPOINT
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
  if (!bucket || !endpoint || !accessKeyId || !accessKeySecret) return null

  const region = process.env.OSS_REGION
  const client = new OSS({
    bucket,
    endpoint,
    region,
    accessKeyId,
    accessKeySecret,
    secure: true,
  })
  const publicBaseUrl =
    process.env.OSS_PUBLIC_BASE_URL ??
    `https://${bucket}.${endpoint.replace(/^https?:\/\//, '')}`
  return {
    publicBaseUrl,
    signer: {
      sign(input: {
        objectKey: string
        contentType: UploadableImageType
        expires: number
      }) {
        return client.signatureUrl(input.objectKey, {
          method: 'PUT',
          expires: input.expires,
          'Content-Type': input.contentType,
        })
      },
    } satisfies ImageUploadSigner,
  }
}
