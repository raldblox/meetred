import { AGENT_SIGNAL_APP_ID } from '@/config/constants'

export type AgentChatPayload = {
  type: 'agent_chat'
  app: typeof AGENT_SIGNAL_APP_ID
  agentPeerId: string
  body: string
  senderPeerId: string
  variant: 'user' | 'model'
  provider?: string
  modelId?: string
  status?: 'pending' | 'complete' | 'error'
  promptId?: string
  createdAt: number
}

export interface AgentChatPayloadInput {
  agentPeerId: string
  body: string
  senderPeerId: string
  variant: 'user' | 'model'
  provider?: string
  modelId?: string
  status?: 'pending' | 'complete' | 'error'
  promptId?: string
}

export const buildAgentChatPayload = ({
  agentPeerId,
  body,
  senderPeerId,
  variant,
  provider,
  modelId,
  status,
  promptId,
}: AgentChatPayloadInput): AgentChatPayload => ({
  type: 'agent_chat',
  app: AGENT_SIGNAL_APP_ID,
  agentPeerId,
  body,
  senderPeerId,
  variant,
  provider,
  modelId,
  status,
  promptId,
  createdAt: Date.now(),
})

export const parseAgentChatPayload = (msg: string): AgentChatPayload | null => {
  try {
    const parsed = JSON.parse(msg)

    if (
      parsed?.type === 'agent_chat' &&
      parsed?.app === AGENT_SIGNAL_APP_ID &&
      typeof parsed.agentPeerId === 'string' &&
      typeof parsed.body === 'string' &&
      (parsed.variant === 'user' || parsed.variant === 'model')
    ) {
      return {
        type: 'agent_chat',
        app: AGENT_SIGNAL_APP_ID,
        agentPeerId: parsed.agentPeerId,
        body: parsed.body,
        senderPeerId: typeof parsed.senderPeerId === 'string' ? parsed.senderPeerId : '',
        variant: parsed.variant,
        provider: typeof parsed.provider === 'string' ? parsed.provider : undefined,
        modelId: typeof parsed.modelId === 'string' ? parsed.modelId : undefined,
        status: parsed.status === 'pending' || parsed.status === 'error' ? parsed.status : 'complete',
        promptId: typeof parsed.promptId === 'string' ? parsed.promptId : undefined,
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      }
    }
  } catch {
    // ignore malformed payloads
  }

  return null
}
