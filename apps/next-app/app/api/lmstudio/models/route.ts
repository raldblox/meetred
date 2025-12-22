import { NextRequest, NextResponse } from 'next/server'

import { LM_STUDIO_DEFAULT_BASE_URL } from '@/config/constants'

const normalizeBaseUrl = (input?: string) => {
  const trimmed = (input ?? LM_STUDIO_DEFAULT_BASE_URL).trim()

  if (!trimmed) {
    return LM_STUDIO_DEFAULT_BASE_URL
  }

  return trimmed.replace(/\/+$/, '')
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const baseUrl = searchParams.get('baseUrl') ?? undefined
  const normalized = normalizeBaseUrl(baseUrl)

  try {
    const response = await fetch(`${normalized}/v1/models`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `LM Studio responded with ${response.status}` },
        { status: response.status === 404 ? 404 : 502 },
      )
    }

    const payload = await response.json()

    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to reach LM Studio' },
      {
        status: 502,
      },
    )
  }
}
