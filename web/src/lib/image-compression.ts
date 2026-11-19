const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const MAX_COMPRESSED_BYTES = 6 * 1024 * 1024
const AVATAR_EDGE = 512
const ALLOWED_SOURCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface CompressedImage {
  blob: Blob
  contentType: 'image/jpeg' | 'image/webp'
}

export async function compressImageForUpload(
  file: File,
): Promise<CompressedImage> {
  if (!ALLOWED_SOURCE_TYPES.has(file.type)) {
    throw new Error('请选择 JPEG、PNG 或 WebP 图片')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('原图不能超过 10MB')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const maxEdge = 1920
    const ratio = Math.min(
      1,
      maxEdge / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理图片')
    context.drawImage(bitmap, 0, 0, width, height)

    const contentType = 'image/webp' as const
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('图片压缩失败')),
        contentType,
        0.82,
      )
    })
    if (blob.size > MAX_COMPRESSED_BYTES) {
      throw new Error('压缩后的图片仍然过大')
    }
    return { blob, contentType }
  } finally {
    bitmap.close()
  }
}

export async function compressAvatarForUpload(
  file: File,
): Promise<CompressedImage> {
  if (!ALLOWED_SOURCE_TYPES.has(file.type)) {
    throw new Error('请选择 JPEG、PNG 或 WebP 图片')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('原图不能超过 10MB')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const cropEdge = Math.min(bitmap.width, bitmap.height)
    const sourceX = Math.round((bitmap.width - cropEdge) * 0.5)
    const sourceY = Math.round((bitmap.height - cropEdge) * 0.45)
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_EDGE
    canvas.height = AVATAR_EDGE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理图片')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      cropEdge,
      cropEdge,
      0,
      0,
      AVATAR_EDGE,
      AVATAR_EDGE,
    )

    const contentType = 'image/webp' as const
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('图片压缩失败')),
        contentType,
        0.9,
      )
    })
    if (blob.size > MAX_COMPRESSED_BYTES) {
      throw new Error('压缩后的图片仍然过大')
    }
    return { blob, contentType }
  } finally {
    bitmap.close()
  }
}
