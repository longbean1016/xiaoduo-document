import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100'
  if (request.headers.get('origin') !== appOrigin) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }
  return NextResponse.json(
    { error: 'COLLABORATOR_PASSWORD_ACTIVATION_RETIRED' },
    { status: 410 },
  )
}
