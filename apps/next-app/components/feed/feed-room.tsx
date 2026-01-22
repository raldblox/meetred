'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Blockies from 'react-18-blockies'
import Link from 'next/link'
import { Button, Textarea, Tooltip } from '@heroui/react'
import { Paperclip, RefreshCw, SendHorizontal } from 'lucide-react'
import { Space_Grotesk, Newsreader } from 'next/font/google'

import type { ChatMessage } from '@/context/chat-ctx'
import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CHAT_TOPIC } from '@/config/constants'
import { wrapMeetredMessage } from '@/lib/envelope'
import { parseStreamChatPayload } from '@/lib/stream-chat'
import { PUBLIC_CHAT_ROOM_ID } from '../chat/chat-room'
import { UI_COPY } from '@/config/copy'

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-feed-display',
})

const bodyFont = Newsreader({
  subsets: ['latin'],
  variable: '--font-feed-body',
})

type MeetingInvitePayload = {
  type: 'meeting_invite'
  roomId: string
  hostPeerId: string
  createdAt?: number
}

type StreamInvitePayload = {
  type: 'stream_invite'
  streamId: string
  hostPeerId: string
  multiaddrs?: string[]
  createdAt?: number
}

type AgentInvitePayload = {
  type: 'agent_invite'
  agentPeerId: string
  createdAt?: number
}

const parseMeetingInvite = (msg: string): MeetingInvitePayload | null => {
  try {
    const parsed = JSON.parse(msg)

    if (
      parsed?.type === 'meeting_invite' &&
      typeof parsed.roomId === 'string' &&
      typeof parsed.hostPeerId === 'string'
    ) {
      return parsed as MeetingInvitePayload
    }
  } catch {
    // ignore non-invite payloads
  }

  return null
}

const parseStreamInvite = (msg: string): StreamInvitePayload | null => {
  try {
    const parsed = JSON.parse(msg)

    if (
      parsed?.type === 'stream_invite' &&
      typeof parsed.streamId === 'string' &&
      typeof parsed.hostPeerId === 'string'
    ) {
      return parsed as StreamInvitePayload
    }
  } catch {
    // ignore invalid payloads
  }

  return null
}

const parseAgentInvite = (msg: string): AgentInvitePayload | null => {
  try {
    const parsed = JSON.parse(msg)

    if (parsed?.type === 'agent_invite' && typeof parsed.agentPeerId === 'string') {
      return parsed as AgentInvitePayload
    }
  } catch {
    // ignore invalid payloads
  }

  return null
}

const formatTimestamp = (timestamp: number) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

const PostInviteCard = ({
  title,
  description,
  cta,
  href,
  meta,
}: {
  title: string
  description: string
  cta: string
  href: string
  meta: string
}) => {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-white/60">{description}</p>
        </div>
        <Button
          as={Link}
          className="h-8 rounded-full border border-white/15 bg-white/10 px-3 text-[11px] uppercase tracking-[0.2em] text-white"
          href={href}
          size="sm"
          variant="flat"
        >
          {cta}
        </Button>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/45">{meta}</p>
    </div>
  )
}

const FeedPost = ({ message, isSelf }: { message: ChatMessage; isSelf: boolean }) => {
  const meetingInvite = useMemo(() => parseMeetingInvite(message.msg), [message.msg])
  const streamInvite = useMemo(() => parseStreamInvite(message.msg), [message.msg])
  const agentInvite = useMemo(() => parseAgentInvite(message.msg), [message.msg])
  const streamChatPayload = useMemo(() => parseStreamChatPayload(message.msg), [message.msg])

  const displayId = message.peerId.slice(-7)
  const timestamp = formatTimestamp(message.receivedAt)
  const deliveryStatus = message.status ?? 'sent'

  return (
    <article className="w-full">
      <header className="flex items-center gap-3">
        <Blockies className="h-9 w-9 rounded-full" scale={10} seed={message.peerId} size={8} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{isSelf ? 'You' : `Peer ${displayId}`}</p>
            {isSelf && (
              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/60">
                Self
              </span>
            )}
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{timestamp}</p>
        </div>
      </header>

      {meetingInvite && (
        <PostInviteCard
          title="Live call invite"
          description="Jump into a live room hosted by the sender."
          cta="Join"
          href={`/call/${meetingInvite.roomId}`}
          meta={`Host ${meetingInvite.hostPeerId.slice(-7)}`}
        />
      )}

      {streamInvite && (
        <PostInviteCard
          title="Stream invite"
          description="Tune into a live stream and chat along."
          cta="Watch"
          href={`/stream/${streamInvite.hostPeerId}`}
          meta={`Host ${streamInvite.hostPeerId.slice(-7)}`}
        />
      )}

      {agentInvite && (
        <PostInviteCard
          title="Agent room"
          description="Join a focused AI room with the host."
          cta="Enter"
          href={`/agent/${agentInvite.agentPeerId}`}
          meta={`Host ${agentInvite.agentPeerId.slice(-7)}`}
        />
      )}

      {streamChatPayload && (
        <div className="mt-3 rounded-xl border border-white/10 bg-[color:var(--feed-card)] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
            Stream chat from {streamChatPayload.hostPeerId.slice(-7)}
          </p>
          <p className="mt-2 text-sm text-white/80">{streamChatPayload.body}</p>
        </div>
      )}

      {!meetingInvite && !streamInvite && !agentInvite && !streamChatPayload && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">{message.msg}</p>
      )}

      {message.fileObjectUrl && (
        <a
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70"
          download={message.fileName ?? 'download'}
          href={message.fileObjectUrl}
          rel="noreferrer"
        >
          Download file
        </a>
      )}

      {isSelf && deliveryStatus !== 'sent' && (
        <p
          className={`mt-3 text-[11px] uppercase tracking-[0.2em] ${deliveryStatus === 'failed' ? 'text-rose-300' : 'text-white/50'}`}
        >
          {deliveryStatus === 'failed' ? 'Failed to send' : 'Sending...'}
        </p>
      )}
    </article>
  )
}

export default function FeedRoom() {
  const { libp2p } = useLibp2pContext()
  const { messageHistory, setMessageHistory } = useChatContext()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartY = useRef<number | null>(null)

  const publicMessages = useMemo(
    () => messageHistory.filter((msg) => !msg.channel || msg.channel === 'public'),
    [messageHistory],
  )
  const sortedVisible = useMemo(
    () => [...visibleMessages].sort((a, b) => b.receivedAt - a.receivedAt),
    [visibleMessages],
  )

  const refreshVisibleMessages = useCallback(() => {
    if (isRefreshing || pendingCount === 0) {
      return
    }

    setIsRefreshing(true)
    setVisibleMessages(publicMessages)
    setPendingCount(0)

    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current)
    }

    refreshTimer.current = setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }, [isRefreshing, pendingCount, publicMessages])

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (pendingCount === 0 || isRefreshing) {
        return
      }

      if (window.scrollY <= 0 && event.deltaY < -40) {
        refreshVisibleMessages()
      }
    }

    const handleTouchStart = (event: TouchEvent) => {
      touchStartY.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (pendingCount === 0 || isRefreshing) {
        return
      }

      const currentY = event.touches[0]?.clientY ?? null

      if (!currentY || touchStartY.current === null) {
        return
      }

      const delta = currentY - touchStartY.current

      if (window.scrollY <= 0 && delta > 60) {
        refreshVisibleMessages()
        touchStartY.current = null
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }, [isRefreshing, pendingCount, refreshVisibleMessages])

  useEffect(() => {
    if (!initialized) {
      if (publicMessages.length === 0) {
        return
      }

      setVisibleMessages(publicMessages)
      setInitialized(true)
      setPendingCount(0)

      return
    }

    const visibleIds = new Set(visibleMessages.map((msg) => msg.msgId))
    const queued = publicMessages.filter((msg) => !visibleIds.has(msg.msgId))

    setPendingCount(queued.length)
  }, [initialized, publicMessages, visibleMessages])

  useEffect(() => {
    return () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current)
      }
    }
  }, [])

  const updateVisibleStatus = useCallback((messageId: string, status: 'sent' | 'failed') => {
    setVisibleMessages((prev) =>
      prev.map((message) => (message.msgId === messageId ? { ...message, status } : message)),
    )
  }, [])

  const sendPublicMessage = useCallback(
    async (rawMessage: string) => {
      const trimmedMessage = rawMessage.trim()

      if (trimmedMessage === '') return

      const myPeerId = libp2p.peerId.toString()
      const pendingMessage: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: trimmedMessage,
        fileObjectUrl: undefined,
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
        status: 'pending',
        channel: 'public',
      }

      setMessageHistory((prev) => [...prev, pendingMessage])
      setVisibleMessages((prev) => [...prev, pendingMessage])

      try {
        const envelope = wrapMeetredMessage(trimmedMessage)

        await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(envelope))

        setMessageHistory((prev) =>
          prev.map((message) => (message.msgId === pendingMessage.msgId ? { ...message, status: 'sent' } : message)),
        )
        updateVisibleStatus(pendingMessage.msgId, 'sent')
      } catch (error) {
        setMessageHistory((prev) =>
          prev.map((message) => (message.msgId === pendingMessage.msgId ? { ...message, status: 'failed' } : message)),
        )
        updateVisibleStatus(pendingMessage.msgId, 'failed')
      }
    },
    [libp2p.peerId, libp2p.services.pubsub, setMessageHistory, updateVisibleStatus],
  )

  const handleSend = useCallback(async () => {
    if (sending) return

    const trimmedMessage = input.trim()

    if (!trimmedMessage) return

    setSending(true)
    try {
      await sendPublicMessage(trimmedMessage)
      setInput('')
    } finally {
      setSending(false)
    }
  }, [input, sendPublicMessage, sending])

  const handleKeyDown = useCallback(
    async (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) {
        return
      }

      event.preventDefault()
      await handleSend()
    },
    [handleSend],
  )

  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} relative`}>
      <div className="relative z-10">
        <section className="w-full py-6  px-4">
          <div className="flex items-start gap-3">
            <Blockies className="mt-1 h-10 w-10 rounded-full" scale={10} seed={libp2p.peerId.toString()} size={8} />
            <div className="flex-1 space-y-2">
              <Textarea
                classNames={{
                  inputWrapper: 'bg-transparent border border-white/15 hover:border-white/30',
                  input: 'text-white/90 text-[15px] leading-relaxed',
                }}
                maxLength={2000}
                minRows={2}
                placeholder="Share a post with the room..."
                value={input}
                variant="flat"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{input.length}/2000</p>
                <Button
                  className="rounded-full bg-white text-xs font-semibold uppercase tracking-[0.2em] text-black"
                  isDisabled={sending}
                  startContent={<SendHorizontal size={14} />}
                  onPress={handleSend}
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="w-full">
          {pendingCount > 0 && (
            <div className="sticky top-2 z-10 mt-4 flex items-center justify-between rounded-full border border-white/10 bg-[#0c1018]/90 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/70 backdrop-blur">
              <span>{isRefreshing ? 'Refreshing...' : `${pendingCount} new posts`}</span>
              <Button
                isDisabled={isRefreshing}
                size="sm"
                startContent={<RefreshCw size={14} />}
                variant="flat"
                onPress={refreshVisibleMessages}
              >
                Refresh
              </Button>
            </div>
          )}

          {sortedVisible.length === 0 ? (
            <div className="flex h-[40vh] flex-col items-center justify-center text-center text-white/50">
              <p className="font-[var(--font-feed-display)] text-lg text-white/70">No posts yet.</p>
              <p className="mt-2 text-sm">Be the first to share something.</p>
            </div>
          ) : (
            <div className="divide-y divide-foreground/10">
              {sortedVisible.map((message) => (
                <div key={message.msgId} className="py-6 px-4">
                  <FeedPost isSelf={message.peerId === libp2p.peerId.toString()} message={message} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
