import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeOwnerMutation } from '@/lib/studio-request'
import { reorderCategories } from '@/server/categories'

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(1000),
})

export async function PUT(request: Request) {
  const authorization = await authorizeOwnerMutation(request)
  if (authorization.error) return authorization.error

  const parsed = reorderSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_CATEGORY_ORDER' },
      { status: 400 },
    )
  }

  const reordered = await reorderCategories(parsed.data.ids)
  if (!reordered) {
    return NextResponse.json(
      { error: 'INVALID_CATEGORY_ORDER' },
      { status: 409 },
    )
  }

  revalidatePath('/')
  revalidatePath('/library')
  return NextResponse.json({ reordered: true })
}
