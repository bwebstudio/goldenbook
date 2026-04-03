import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getWebHomeData } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const locale = searchParams.get('locale') ?? 'en'
    const city = searchParams.get('city') ?? 'lisboa'

    const data = await getWebHomeData(city, locale)

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    console.error('[api/web/home] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch homepage data' },
      { status: 500 },
    )
  }
}
