import { NextResponse } from 'next/server'
import { authorizeOwnerMutation } from '@/lib/studio-request'

export async function POST(
  request: Request,
) {
  const authorization = await authorizeOwnerMutation(request)
  if (authorization.error) return authorization.error
  return NextResponse.json(
    { error: 'COLLABORATION_APPLICATIONS_RETIRED' },
    { status: 410 },
  )
}
