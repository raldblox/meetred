import { LM_STUDIO_DEFAULT_BASE_URL } from '@/config/constants'

export interface LMStudioModel {
  id: string
  object?: string
  owned_by?: string
  description?: string
}

export interface LMStudioChatResult {
  text: string
  modelId: string
  raw?: unknown
}

export interface LMStudioChatOptions {
  baseUrl?: string
  modelId: string
  prompt: string
  temperature?: number
  signal?: AbortSignal
}

const normalizeBaseUrl = (input?: string) => {
  const trimmed = (input ?? LM_STUDIO_DEFAULT_BASE_URL).trim()

  if (!trimmed) {
    return LM_STUDIO_DEFAULT_BASE_URL
  }

  return trimmed.replace(/\/+$/, '')
}

export const fetchLMStudioModels = async (baseUrl?: string): Promise<LMStudioModel[]> => {
  const search = baseUrl ? `?baseUrl=${encodeURIComponent(normalizeBaseUrl(baseUrl))}` : ''
  const response = await fetch(`/api/lmstudio/models${search}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))

    throw new Error(payload?.error ?? `LM Studio responded with ${response.status}`)
  }

  const payload = await response.json()
  const list = Array.isArray(payload?.data) ? payload.data : []
  const normalized: Array<LMStudioModel | null> = list.map((model: any): LMStudioModel | null => {
    if (!model || typeof model !== 'object') {
      return null
    }

    const id = typeof model.id === 'string' ? model.id : typeof model.name === 'string' ? model.name : null

    if (!id) {
      return null
    }

    return {
      id,
      object: typeof model.object === 'string' ? model.object : undefined,
      owned_by: typeof model.owned_by === 'string' ? model.owned_by : undefined,
      description: typeof model.description === 'string' ? model.description : undefined,
    }
  })

  return normalized.filter((entry): entry is LMStudioModel => Boolean(entry))
}

export const createLMStudioChatCompletion = async ({
  baseUrl,
  modelId,
  prompt,
  temperature = 0.2,
  signal,
}: LMStudioChatOptions): Promise<LMStudioChatResult> => {
  const response = await fetch(`/api/lmstudio/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      baseUrl: baseUrl ? normalizeBaseUrl(baseUrl) : undefined,
      modelId,
      prompt,
      temperature,
    }),
    signal,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))

    throw new Error(payload?.error ?? `LM Studio responded with ${response.status}`)
  }

  const payload = await response.json()
  const message = payload?.choices?.[0]?.message?.content

  if (typeof message !== 'string') {
    throw new Error('LM Studio response missing content')
  }

  return {
    text: message,
    modelId,
    raw: payload,
  }
}
