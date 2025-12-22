import { NextRequest, NextResponse } from 'next/server'

import { LM_STUDIO_DEFAULT_BASE_URL } from '@/config/constants'

const normalizeBaseUrl = (input?: string) => {
  const trimmed = (input ?? LM_STUDIO_DEFAULT_BASE_URL).trim()

  if (!trimmed) {
    return LM_STUDIO_DEFAULT_BASE_URL
  }

  return trimmed.replace(/\/+$/, '')
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : undefined
  const modelId = typeof body.modelId === 'string' ? body.modelId : ''
  const prompt = typeof body.prompt === 'string' ? body.prompt : ''
  const temperature = typeof body.temperature === 'number' && Number.isFinite(body.temperature) ? body.temperature : 0.2

  if (!modelId || !prompt) {
    return NextResponse.json({ error: 'modelId and prompt are required' }, { status: 400 })
  }

  const normalized = normalizeBaseUrl(baseUrl)

  try {
    const lmResponse = await fetch(`${normalized}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        stream: false,
        temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!lmResponse.ok) {
      return NextResponse.json(
        { error: `LM Studio responded with ${lmResponse.status}` },
        { status: lmResponse.status === 404 ? 404 : 502 },
      )
    }

    const payload = await lmResponse.json()

    return NextResponse.json(payload)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to reach LM Studio' }, { status: 502 })
  }
}
