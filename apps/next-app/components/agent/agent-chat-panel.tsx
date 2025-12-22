'use client'

import type { AgentChatPayload } from '@/lib/agent-chat'
import type { ChatMessage } from '@/context/chat-ctx'

import { useCallback, useMemo, useState } from 'react'
import Blockies from 'react-18-blockies'
import { SendIcon } from 'lucide-react'
import { Button, Input, ScrollShadow } from '@heroui/react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CHAT_TOPIC } from '@/config/constants'
import { buildAgentChatPayload, parseAgentChatPayload } from '@/lib/agent-chat'
import { forComponent } from '@/lib/logger'
import { useAgentContext } from '@/context/agent-ctx'
import { createLMStudioChatCompletion } from '@/lib/lmstudio'

interface AgentChatPanelProps {
  agentPeerId: string
}

const log = forComponent('agent-chat-panel')
const textEncoder = new TextEncoder()

export function AgentChatPanel({ agentPeerId }: AgentChatPanelProps) {
  const { messageHistory, setMessageHistory } = useChatContext()
  const { libp2p } = useLibp2pContext()
  const { models, selectedModelId, sendPrompt, isHost, authorized, lmBaseUrl } = useAgentContext()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const selfPeerId = libp2p.peerId.toString()

  const appendLocalChatPayload = useCallback(
    (payload: AgentChatPayload) => {
      const encoded = JSON.stringify(payload)
      const peerId = payload.senderPeerId || selfPeerId

      setMessageHistory((prev) => [
        ...prev,
        {
          msgId: crypto.randomUUID(),
          msg: encoded,
          fileObjectUrl: undefined,
          peerId,
          read: true,
          receivedAt: Date.now(),
          status: 'sent',
        },
      ])

      return encoded
    },
    [selfPeerId, setMessageHistory],
  )

  const chats = useMemo(() => {
    const rows: { payload: AgentChatPayload; original: ChatMessage }[] = []

    messageHistory.forEach((message) => {
      const payload = parseAgentChatPayload(message.msg)

      if (payload && payload.agentPeerId === agentPeerId) {
        rows.push({ payload, original: message })
      }
    })

    const sorted = rows.sort((a, b) => a.original.receivedAt - b.original.receivedAt)
    const promptHasFinal = new Set<string>()

    sorted.forEach(({ payload }) => {
      if (payload.promptId && payload.variant === 'model' && payload.status && payload.status !== 'pending') {
        promptHasFinal.add(payload.promptId)
      }
    })

    return sorted.filter(({ payload }) => {
      if (
        payload.promptId &&
        payload.variant === 'model' &&
        payload.status === 'pending' &&
        promptHasFinal.has(payload.promptId)
      ) {
        return false
      }

      return true
    })
  }, [agentPeerId, messageHistory])

  const handleSend = async () => {
    const trimmed = input.trim()

    if (!trimmed || sending) {
      return
    }

    const resolvedModelId = selectedModelId ?? models[0]?.id ?? undefined
    const promptId = crypto.randomUUID()

    setSending(true)

    try {
      const senderPeerId = selfPeerId
      const payload = buildAgentChatPayload({
        agentPeerId,
        body: trimmed,
        senderPeerId,
        variant: 'user',
        modelId: resolvedModelId,
        promptId,
        status: 'complete',
      })
      const encoded = appendLocalChatPayload(payload)

      await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(encoded))
      setInput('')

      if (isHost) {
        if (!resolvedModelId) {
          const errorPayload = buildAgentChatPayload({
            agentPeerId,
            body: 'No local model selected. Please choose one first.',
            senderPeerId,
            variant: 'model',
            promptId,
            status: 'error',
          })
          const errorEncoded = appendLocalChatPayload(errorPayload)

          await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(errorEncoded))

          return
        }

        const pendingPayload = buildAgentChatPayload({
          agentPeerId,
          body: 'Agent is thinking...',
          senderPeerId,
          variant: 'model',
          modelId: resolvedModelId,
          promptId,
          status: 'pending',
        })
        const pendingEncoded = appendLocalChatPayload(pendingPayload)

        await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(pendingEncoded))

        const completion = await createLMStudioChatCompletion({
          baseUrl: lmBaseUrl,
          modelId: resolvedModelId,
          prompt: trimmed,
        })

        const responsePayload = buildAgentChatPayload({
          agentPeerId,
          body: completion.text,
          senderPeerId,
          variant: 'model',
          modelId: resolvedModelId,
          promptId,
          status: 'complete',
        })
        const responseEncoded = appendLocalChatPayload(responsePayload)

        await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(responseEncoded))
      } else {
        const promptOptions = resolvedModelId ? { promptId, modelId: resolvedModelId } : { promptId }

        await sendPrompt(trimmed, promptOptions)
      }
    } catch (error) {
      log.error('failed to send agent chat message %o', error)
      const senderPeerId = selfPeerId
      const responsePayload = buildAgentChatPayload({
        agentPeerId,
        body: error instanceof Error ? error.message : 'Failed to contact host model.',
        senderPeerId,
        variant: 'model',
        modelId: resolvedModelId,
        promptId,
        status: 'error',
      })
      const responseEncoded = appendLocalChatPayload(responsePayload)

      await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(responseEncoded))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl bg-default-50 p-4 shadow-sm">
      <div className="flex flex-col gap-1 border-b border-default-200 pb-3">
        <p className="text-sm font-semibold text-default-700">Agent Chat</p>
        <p className="text-[11px] uppercase tracking-wide text-default-400">
          {authorized ? 'Responses stream from the host model' : 'Waiting for host model'}
        </p>
        <p className="text-xs text-default-500">
          {selectedModelId ? `Active model - ${selectedModelId}` : 'No model selected yet'}
        </p>
      </div>

      <ScrollShadow hideScrollBar className="flex-1 min-h-0 space-y-3 py-3 pr-1">
        {chats.length === 0 ? (
          <p className="text-xs text-default-500 text-center">No chat messages yet.</p>
        ) : (
          chats.map(({ payload, original }) => (
            <div key={original.msgId} className="flex items-start gap-3">
              <Blockies className="rounded" scale={3} seed={payload.senderPeerId || original.peerId} size={8} />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-default-400">
                  <span className="font-mono text-default-500">
                    {(payload.senderPeerId || original.peerId).slice(-7)}
                  </span>
                  {payload.modelId && <span className="text-default-500">{payload.modelId.slice(-7)}</span>}
                  <span>
                    {new Date(original.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <ChatBubble
                  isHostMessage={payload.senderPeerId === agentPeerId && payload.variant === 'user'}
                  isSelf={payload.senderPeerId === libp2p.peerId.toString()}
                  payload={payload}
                />
              </div>
            </div>
          ))
        )}
      </ScrollShadow>

      <div className="border-t border-default-200 pt-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder={
              authorized
                ? 'Ask the connected model anything...'
                : 'Host is connecting their model, prompts will send once ready...'
            }
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            isIconOnly
            aria-label="Send agent chat"
            disabled={!input.trim() || sending}
            radius="full"
            onPress={handleSend}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({
  payload,
  isHostMessage,
  isSelf,
}: {
  payload: AgentChatPayload
  isHostMessage: boolean
  isSelf: boolean
}) {
  const isAgentResponse = payload.variant === 'model'

  const bubbleClass = clsx(
    'w-fit max-w-full rounded-2xl border px-3 py-2 text-sm shadow-sm',
    isAgentResponse
      ? payload.status === 'pending'
        ? 'border-primary-200 bg-primary-50 text-primary-700 animate-pulse'
        : payload.status === 'error'
          ? 'border-danger-200 bg-danger-50 text-danger-600'
          : 'border-primary-200 bg-primary-100 text-primary-900'
      : isHostMessage
        ? 'border-success-200 bg-success-100 text-success-900'
        : isSelf
          ? 'border-secondary-200 bg-secondary-100 text-secondary-900'
          : 'border-default-200 bg-default-100 text-default-800',
  )

  if (isAgentResponse) {
    if (payload.status === 'pending') {
      return <div className={bubbleClass}>Agent is thinking...</div>
    }

    return (
      <div className={clsx(bubbleClass, 'prose prose-sm text-current')}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.body}</ReactMarkdown>
      </div>
    )
  }

  return <p className={bubbleClass}>{payload.body}</p>
}
