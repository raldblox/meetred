'use client'

import type { ReactNode } from 'react'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import { CHAT_TOPIC } from '@/config/constants'
import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { LM_STUDIO_DEFAULT_BASE_URL, LM_STUDIO_DEFAULT_TARGET_URL } from '@/config/constants'
import { wrapMeetredMessage } from '@/lib/envelope'

export type CreateSessionKind = 'stream' | 'ai' | 'call' | 'file'

export type CreateSessionDraft = {
  kind: CreateSessionKind
  note: string
  modelId: string
  provider: 'lmstudio' | 'openai'
  agentBaseUrl: string
  lmStudioUrl: string
  openAIKey: string
  fileLabel: string
  callVisibility: 'private' | 'public'
  streamCamera: boolean
  streamMic: boolean
}

export type CreatedSession = {
  kind: CreateSessionKind
  roomId: string
  hostPeerId: string
  createdAt: number
  note?: string
  modelId?: string
  provider?: string
}

type CreateSessionContextValue = {
  isOpen: boolean
  isPublishing: boolean
  draft: CreateSessionDraft
  lastCreated: CreatedSession | null
  open: (kind?: CreateSessionKind) => void
  close: () => void
  updateDraft: (next: Partial<CreateSessionDraft>) => void
  resetDraft: () => void
  publish: () => Promise<CreatedSession | null>
  clearLastCreated: () => void
}

const DEFAULT_DRAFT: CreateSessionDraft = {
  kind: 'stream',
  note: '',
  modelId: '',
  provider: 'lmstudio',
  agentBaseUrl: LM_STUDIO_DEFAULT_BASE_URL,
  lmStudioUrl: LM_STUDIO_DEFAULT_TARGET_URL,
  openAIKey: '',
  fileLabel: '',
  callVisibility: 'private',
  streamCamera: true,
  streamMic: true,
}

const CreateSessionContext = createContext<CreateSessionContextValue | null>(null)

export function CreateSessionProvider({ children }: { children: ReactNode }) {
  const { libp2p } = useLibp2pContext()
  const { setMessageHistory } = useChatContext()
  const [isOpen, setIsOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [draft, setDraft] = useState<CreateSessionDraft>(DEFAULT_DRAFT)
  const [lastCreated, setLastCreated] = useState<CreatedSession | null>(null)

  const open = useCallback((kind?: CreateSessionKind) => {
    if (kind) {
      setDraft((prev) => ({ ...prev, kind }))
    }
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const updateDraft = useCallback((next: Partial<CreateSessionDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }))
  }, [])

  const resetDraft = useCallback(() => {
    setDraft(DEFAULT_DRAFT)
  }, [])

  const clearLastCreated = useCallback(() => {
    setLastCreated(null)
  }, [])

  const publishInvite = useCallback(
    async (payload: object) => {
      const envelope = wrapMeetredMessage(JSON.stringify(payload))

      await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(envelope))
    },
    [libp2p.services.pubsub],
  )

  const addLocalInvite = useCallback(
    (payload: object) => {
      const now = Date.now()
      const message = {
        msgId: crypto.randomUUID(),
        msg: JSON.stringify(payload),
        fileObjectUrl: undefined,
        peerId: libp2p.peerId.toString(),
        read: true,
        receivedAt: now,
        status: 'sent',
        channel: 'public',
      }

      setMessageHistory((prev) => [...prev, message])
    },
    [libp2p.peerId, setMessageHistory],
  )

  const publish = useCallback(async (): Promise<CreatedSession | null> => {
    if (isPublishing) {
      return null
    }

    setIsPublishing(true)
    const hostPeerId = libp2p.peerId.toString()
    const createdAt = Date.now()
    let created: CreatedSession | null = null

    try {
      if (draft.kind === 'stream') {
        const payload = {
          type: 'stream_invite',
          streamId: hostPeerId,
          hostPeerId,
          createdAt,
          note: draft.note || undefined,
        }

        await publishInvite(payload)
        addLocalInvite(payload)
        created = {
          kind: 'stream',
          roomId: hostPeerId,
          hostPeerId,
          createdAt,
          note: payload.note,
        }
        setLastCreated(created)
      }

      if (draft.kind === 'ai') {
        const payload = {
          type: 'agent_invite',
          agentPeerId: hostPeerId,
          createdAt,
          note: draft.note || undefined,
          modelId: draft.modelId || undefined,
          provider: draft.provider || undefined,
        }

        await publishInvite(payload)
        addLocalInvite(payload)
        created = {
          kind: 'ai',
          roomId: hostPeerId,
          hostPeerId,
          createdAt,
          note: payload.note,
          modelId: payload.modelId,
          provider: payload.provider,
        }
        setLastCreated(created)
      }

      if (draft.kind === 'call') {
        const payload = {
          type: 'meeting_invite',
          roomId: hostPeerId,
          hostPeerId,
          createdAt,
          note: draft.note || undefined,
          visibility: draft.callVisibility,
        }

        await publishInvite(payload)
        addLocalInvite(payload)
        created = {
          kind: 'call',
          roomId: hostPeerId,
          hostPeerId,
          createdAt,
          note: payload.note,
        }
        setLastCreated(created)
      }

      if (draft.kind === 'file') {
        const payload = {
          type: 'file_share_invite',
          roomId: hostPeerId,
          hostPeerId,
          createdAt,
          note: draft.note || undefined,
          label: draft.fileLabel || undefined,
        }

        await publishInvite(payload)
        addLocalInvite(payload)
        created = {
          kind: 'file',
          roomId: hostPeerId,
          hostPeerId,
          createdAt,
          note: payload.note,
        }
        setLastCreated(created)
      }
      return created
    } finally {
      setIsPublishing(false)
    }
  }, [addLocalInvite, draft, isPublishing, libp2p.peerId, publishInvite])

  const value = useMemo<CreateSessionContextValue>(
    () => ({
      isOpen,
      isPublishing,
      draft,
      lastCreated,
      open,
      close,
      updateDraft,
      resetDraft,
      publish,
      clearLastCreated,
    }),
    [isOpen, isPublishing, draft, lastCreated, open, close, updateDraft, resetDraft, publish, clearLastCreated],
  )

  return <CreateSessionContext.Provider value={value}>{children}</CreateSessionContext.Provider>
}

export function useCreateSessionModal() {
  const ctx = useContext(CreateSessionContext)

  if (!ctx) {
    throw new Error('useCreateSessionModal must be used within CreateSessionProvider')
  }

  return ctx
}
