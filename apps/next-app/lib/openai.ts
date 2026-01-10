import type { LMStudioModel } from '@/lib/lmstudio'

import { LM_STUDIO_DEFAULT_BASE_URL } from '@/config/constants'

export const storeOpenAIKey = async (apiKey: string, baseUrl?: string) => {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/openai/key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))

    throw new Error(payload?.error ?? 'Failed to save OpenAI API key')
  }
}

const FALLBACK_OPENAI_MODELS: LMStudioModel[] = [
  { id: 'gpt-4o-mini', description: 'GPT-4o mini (recommended for chat)' },
  { id: 'gpt-4.1-mini', description: 'GPT-4.1 mini' },
  { id: 'gpt-4o-mini-tts', description: 'GPT-4o mini with TTS support' },
  { id: 'gpt-4.1', description: 'GPT-4.1 (standard)' },
  { id: 'o4-mini', description: 'OpenAI O4 reasoning model' },
]

export const fetchOpenAIModels = async (baseUrl?: string): Promise<LMStudioModel[]> => {
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/openai/models`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))

      throw new Error(payload?.error ?? 'Failed to load OpenAI models')
    }

    const payload = await response.json()
    const list = Array.isArray(payload?.data) ? payload.data : []

    const normalized = list
      .filter((model: any) => typeof model?.id === 'string')
      .map(
        (model: any): LMStudioModel => ({
          id: model.id,
          object: typeof model.object === 'string' ? model.object : undefined,
          owned_by: typeof model.owned_by === 'string' ? model.owned_by : undefined,
          description: typeof model.description === 'string' ? model.description : undefined,
          created: typeof model.created === 'number' ? model.created : undefined,
        }),
      )

    const chatCandidates = normalized.filter((model: LMStudioModel) => /(gpt|o1|o4)/i.test(model.id ?? ''))
    const sorted = chatCandidates.sort((a: LMStudioModel, b: LMStudioModel) => {
      const left = typeof a.created === 'number' ? a.created : 0
      const right = typeof b.created === 'number' ? b.created : 0

      return right - left
    })

    return sorted.length > 0 ? sorted : FALLBACK_OPENAI_MODELS
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to fetch OpenAI models, falling back to defaults', error)

    return FALLBACK_OPENAI_MODELS
  }
}

export const createOpenAIChatCompletion = async ({
  baseUrl,
  modelId,
  prompt,
  temperature = 0.2,
  signal,
  systemPrompt,
}: {
  baseUrl?: string
  modelId: string
  prompt: string
  temperature?: number
  signal?: AbortSignal
  systemPrompt?: string
}): Promise<{ text: string; raw: unknown }> => {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/openai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId,
      prompt,
      temperature,
      systemPrompt,
    }),
    signal,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))

    throw new Error(payload?.error ?? 'Failed to contact OpenAI')
  }

  const payload = await response.json()
  const message = payload?.choices?.[0]?.message?.content

  if (typeof message !== 'string') {
    throw new Error('OpenAI response missing content')
  }

  return {
    text: message.trim(),
    raw: payload,
  }
}

const normalizeBaseUrl = (input?: string) => {
  const trimmed = (input ?? LM_STUDIO_DEFAULT_BASE_URL).trim()

  if (!trimmed) {
    return LM_STUDIO_DEFAULT_BASE_URL
  }

  return trimmed.replace(/\/+$/, '')
}
