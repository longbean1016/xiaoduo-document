import { NextResponse } from 'next/server'
import { authorizeOwnerMutation } from '@/lib/studio-request'
import {
  createOssImageUploadConfiguration,
  uploadProfileImage,
} from '@/server/image-upload'

export async function POST(request: Request) {
  const authorization = await authorizeOwnerMutation(request)
  if (authorization.error) return authorization.error

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_IMAGE_UPLOAD' },
      { status: 400 },
    )
  }
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'INVALID_IMAGE_UPLOAD' },
      { status: 400 },
    )
  }

  const configuration = createOssImageUploadConfiguration()
  if (!configuration) {
    return NextResponse.json(
      { error: 'OSS_NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  try {
    const upload = await uploadProfileImage(
      {
        userId: authorization.session.user.id,
        file,
      },
      configuration,
    )
    return NextResponse.json({ upload }, { status: 201 })
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : 'UPLOAD_FAILED'
    const code =
      rawCode === 'UNSUPPORTED_IMAGE_TYPE' ||
      rawCode === 'IMAGE_TOO_LARGE'
        ? rawCode
        : 'UPLOAD_FAILED'
    return NextResponse.json(
      { error: code },
      {
        status:
          code === 'IMAGE_TOO_LARGE'
            ? 413
            : code === 'UNSUPPORTED_IMAGE_TYPE'
              ? 415
              : 502,
      },
    )
  }
}
