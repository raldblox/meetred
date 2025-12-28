'use client'

import type { ChatMessage } from '@/context/chat-ctx'
import type { StreamChatPayload } from '@/lib/stream-chat'

import { useMemo, useState } from 'react'
import Blockies from 'react-18-blockies'
import { SendIcon } from 'lucide-react'
import { Button, Input, ScrollShadow } from '@heroui/react'

import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CHAT_TOPIC } from '@/config/constants'
import { buildStreamChatPayload, parseStreamChatPayload } from '@/lib/stream-chat'
import { forComponent } from '@/lib/logger'
import { encodeZeroWidth } from '@/lib/metered-envelope'
import { STREAM_ROOM_COPY } from '@/config/copy'

interface StreamChatPanelProps {
  streamId: string
}

const log = forComponent('stream-chat-panel')

export function StreamChatPanel({ streamId }: StreamChatPanelProps) {
  const { messageHistory, setMessageHistory } = useChatContext()
  const { libp2p } = useLibp2pContext()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const chats = useMemo(() => {
    const items: { payload: StreamChatPayload; original: ChatMessage }[] = []

    messageHistory.forEach((message) => {
      const payload = parseStreamChatPayload(message.msg)

      if (payload && payload.streamId === streamId) {
        items.push({ payload, original: message })
      }
    })

    return items.sort((a, b) => a.original.receivedAt - b.original.receivedAt)
  }, [messageHistory, streamId])

  const handleSend = async () => {
    const trimmed = input.trim()

    if (!trimmed || sending) {
      return
    }

    setSending(true)

    try {
      const senderPeerId = libp2p.peerId.toString()
      const payload = buildStreamChatPayload(streamId, streamId, trimmed, senderPeerId)
      const encoded = JSON.stringify(payload)
      const obfuscated = encodeZeroWidth(encoded)

      // Publish to the shared UC topic so discovery keeps working even if peers only subscribe there.
      await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(obfuscated))

      const optimisticMessage: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: encoded,
        fileObjectUrl: undefined,
        peerId: senderPeerId,
        read: true,
        receivedAt: Date.now(),
        channel: 'stream',
      }

      setMessageHistory((prev) => [...prev, optimisticMessage])
      setInput('')
    } catch (error) {
      log.error('Failed to send stream chat message %o', error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl bg-default-50 p-4 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-default-200">
        <div>
          <p className="text-sm font-semibold text-default-700">{STREAM_ROOM_COPY.chat.title}</p>
          <p className="text-[11px] uppercase tracking-wide text-default-400">{STREAM_ROOM_COPY.chat.audienceLabel}</p>
        </div>
      </div>
      <ScrollShadow hideScrollBar className="flex-1 min-h-0 space-y-3 py-3 pr-1">
        {chats.length === 0 ? (
          <p className="text-xs text-default-500 text-center">{STREAM_ROOM_COPY.chat.empty}</p>
        ) : (
          chats.map(({ payload, original }) => (
            <div key={original.msgId} className="flex items-start gap-3">
              <Blockies className="rounded" scale={10} seed={payload.senderPeerId || original.peerId} size={8} />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-default-400">
                  <span className="font-mono text-default-500">
                    {(payload.senderPeerId || original.peerId).slice(-7)}
                  </span>
                  <span>
                    {new Date(original.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-default-800 break-words">{payload.body}</p>
              </div>
            </div>
          ))
        )}
      </ScrollShadow>
      <div className="pt-3 border-t border-default-200">
        <div className="flex items-center gap-2">
          <Input
            disabled={sending}
            placeholder={STREAM_ROOM_COPY.chat.placeholder}
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
            aria-label={STREAM_ROOM_COPY.chat.send}
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
