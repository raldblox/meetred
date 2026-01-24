'use client'

import React, { useCallback, useMemo, useState } from 'react'
import Blockies from 'react-18-blockies'
import Link from 'next/link'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react'
import { Plus, Share2, Users, Sparkles, Video, FileText, MessageSquareText } from 'lucide-react'
import { Space_Grotesk, Newsreader } from 'next/font/google'

import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { parseStreamChatPayload } from '@/lib/stream-chat'
import { parseAgentChatPayload } from '@/lib/agent-chat'
import { usePeerPresence } from '@/hooks/usePeerPresence'
import { useCreateSessionModal } from '@/context/create-session-ctx'

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-feed-display',
})

const bodyFont = Newsreader({
  subsets: ['latin'],
  variable: '--font-feed-body',
})

type StreamInvitePayload = {
  type: 'stream_invite'
  streamId: string
  hostPeerId: string
  createdAt?: number
  note?: string
}

type AgentInvitePayload = {
  type: 'agent_invite'
  agentPeerId: string
  createdAt?: number
  note?: string
  modelId?: string
  provider?: string
}

type MeetingInvitePayload = {
  type: 'meeting_invite'
  roomId: string
  hostPeerId: string
  createdAt?: number
  note?: string
  visibility?: 'private' | 'public'
}

type FileInvitePayload = {
  type: 'file_share_invite'
  roomId: string
  hostPeerId: string
  createdAt?: number
  note?: string
  label?: string
}

type FeedInvite = {
  id: string
  kind: 'stream' | 'ai' | 'call' | 'file'
  title: string
  roomId: string
  hostPeerId: string
  createdAt: number
  note?: string
  modelId?: string
  provider?: string
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
    // ignore invalid payloads
  }

  return null
}

const parseFileInvite = (msg: string): FileInvitePayload | null => {
  try {
    const parsed = JSON.parse(msg)

    if (
      parsed?.type === 'file_share_invite' &&
      typeof parsed.roomId === 'string' &&
      typeof parsed.hostPeerId === 'string'
    ) {
      return parsed as FileInvitePayload
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

const typeStyles: Record<FeedInvite['kind'], { label: string; color: string; badge: string }> = {
  stream: {
    label: 'Live Stream',
    color: 'bg-sky-500/15 border-sky-400/40 text-sky-50',
    badge: 'bg-sky-400/20 text-sky-100',
  },
  ai: {
    label: 'AI Room',
    color: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-50',
    badge: 'bg-emerald-400/20 text-emerald-100',
  },
  call: {
    label: 'Private Call',
    color: 'bg-amber-500/15 border-amber-400/40 text-amber-50',
    badge: 'bg-amber-400/20 text-amber-100',
  },
  file: {
    label: 'File Share',
    color: 'bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-50',
    badge: 'bg-fuchsia-400/20 text-fuchsia-100',
  },
}

const buildShareUrl = (kind: FeedInvite['kind'], roomId: string) => {
  if (kind === 'stream') return `/stream/${roomId}`
  if (kind === 'ai') return `/agent/${roomId}`
  if (kind === 'call') return `/call/${roomId}`

  return `/chat`
}

const FeedCard = ({
  invite,
  chatCount,
  online,
  onShare,
  onOpen,
}: {
  invite: FeedInvite
  chatCount: number
  online: boolean
  onShare: (invite: FeedInvite) => void
  onOpen: (inviteId: string) => void
}) => {
  const styles = typeStyles[invite.kind]

  return (
    <article className={`group relative overflow-hidden rounded-2xl border ${styles.color} shadow-lg`}>
      <button
        aria-label={`Open ${invite.title}`}
        className="absolute inset-0 z-0"
        type="button"
        onClick={() => onOpen(invite.id)}
      />
      <div className="relative z-10 aspect-square overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/10 to-transparent" />
        {invite.kind === 'stream' && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] uppercase tracking-[0.3em] text-white/70">
            Live preview
          </div>
        )}
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/80">
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-white/30'}`} />
          {online ? 'Live' : 'Offline'}
        </div>
        <div
          className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${styles.badge}`}
        >
          {styles.label}
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-2">
            <Blockies className="h-8 w-8 rounded-full" scale={10} seed={invite.hostPeerId} size={8} />
            <div>
              <p className="text-sm font-semibold text-white">Host {invite.hostPeerId.slice(-7)}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                {formatTimestamp(invite.createdAt)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[15px] font-semibold text-white">{invite.title}</p>
          {invite.note && <p className="mt-1 text-sm text-white/70">{invite.note}</p>}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-white/10 bg-black/50 px-4 py-3 text-xs text-white/70">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          <span>{chatCount}</span>
        </div>
        <div className="flex items-center gap-2">
          {invite.kind === 'ai' && (
            <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
              {invite.modelId ? invite.modelId : 'Model unknown'}
              {invite.provider ? ` - ${invite.provider}` : ''}
            </span>
          )}
          <Button
            className="h-8 rounded-full border border-white/15 bg-white/10 px-3 text-[11px] uppercase tracking-[0.2em] text-white"
            size="sm"
            variant="flat"
            onPress={(event) => {
              onShare(invite)
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>
      </div>
    </article>
  )
}

export default function FeedRoom() {
  const { libp2p } = useLibp2pContext()
  const { messageHistory } = useChatContext()
  const presence = usePeerPresence()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [filter, setFilter] = useState<'all' | FeedInvite['kind']>('all')
  const { open } = useCreateSessionModal()

  const onlinePeers = useMemo(() => {
    const map = new Map<string, boolean>()

    presence.forEach((peer) => {
      map.set(peer.peerId, peer.status === 'online')
    })

    return map
  }, [presence])

  const chatCounts = useMemo(() => {
    const counts = new Map<string, number>()

    messageHistory.forEach((message) => {
      const streamPayload = parseStreamChatPayload(message.msg)

      if (streamPayload?.streamId) {
        counts.set(streamPayload.streamId, (counts.get(streamPayload.streamId) ?? 0) + 1)

        return
      }
      const agentPayload = parseAgentChatPayload(message.msg)

      if (agentPayload?.agentPeerId) {
        counts.set(agentPayload.agentPeerId, (counts.get(agentPayload.agentPeerId) ?? 0) + 1)
      }
    })

    return counts
  }, [messageHistory])

  const feedInvites = useMemo<FeedInvite[]>(() => {
    const invites: FeedInvite[] = []

    messageHistory.forEach((message) => {
      const meetingInvite = parseMeetingInvite(message.msg)

      if (meetingInvite) {
        invites.push({
          id: message.msgId,
          kind: 'call',
          title: 'Private call',
          roomId: meetingInvite.roomId,
          hostPeerId: meetingInvite.hostPeerId,
          createdAt: meetingInvite.createdAt ?? message.receivedAt,
          note: meetingInvite.note,
        })

        return
      }

      const streamInvite = parseStreamInvite(message.msg)

      if (streamInvite) {
        invites.push({
          id: message.msgId,
          kind: 'stream',
          title: 'Live stream',
          roomId: streamInvite.streamId,
          hostPeerId: streamInvite.hostPeerId,
          createdAt: streamInvite.createdAt ?? message.receivedAt,
          note: streamInvite.note,
        })

        return
      }

      const agentInvite = parseAgentInvite(message.msg)

      if (agentInvite) {
        invites.push({
          id: message.msgId,
          kind: 'ai',
          title: 'AI room',
          roomId: agentInvite.agentPeerId,
          hostPeerId: agentInvite.agentPeerId,
          createdAt: agentInvite.createdAt ?? message.receivedAt,
          note: agentInvite.note,
          modelId: agentInvite.modelId,
          provider: agentInvite.provider,
        })

        return
      }

      const fileInvite = parseFileInvite(message.msg)

      if (fileInvite) {
        invites.push({
          id: message.msgId,
          kind: 'file',
          title: fileInvite.label ? `File share: ${fileInvite.label}` : 'File share',
          roomId: fileInvite.roomId,
          hostPeerId: fileInvite.hostPeerId,
          createdAt: fileInvite.createdAt ?? message.receivedAt,
          note: fileInvite.note,
        })
      }
    })

    return invites
  }, [messageHistory])

  const visibleInvites = useMemo(() => {
    const filtered = feedInvites.filter((invite) => {
      if (invite.hostPeerId === libp2p.peerId.toString()) {
        return true
      }

      return onlinePeers.get(invite.hostPeerId) === true
    })

    const filteredByType = filter === 'all' ? filtered : filtered.filter((invite) => invite.kind === filter)

    return filteredByType.sort((a, b) => b.createdAt - a.createdAt)
  }, [feedInvites, filter, libp2p.peerId, onlinePeers])

  const handleShare = useCallback(async (invite: FeedInvite) => {
    const url = `${window.location.origin}${buildShareUrl(invite.kind, invite.roomId)}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: invite.title,
          text: invite.note ?? invite.title,
          url,
        })

        return
      } catch {
        // fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore clipboard failures
    }
  }, [])

  const handleOpenPreview = useCallback(
    (inviteId: string) => {
      const index = visibleInvites.findIndex((invite) => invite.id === inviteId)

      if (index === -1) {
        return
      }
      setPreviewIndex(index)
      setIsPreviewOpen(true)
    },
    [visibleInvites],
  )

  const previewInvite = visibleInvites[previewIndex]

  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} relative px-4 pb-12 pt-6`}>
      <header className="mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Live sessions</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Go live or join a room</h1>
            <p className="mt-2 text-sm text-white/60">Tap a card to jump in. Only live sessions show up here.</p>
          </div>
          <Button
            className="h-11 rounded-full border border-white/20 bg-white/10 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-white"
            startContent={<Plus size={16} />}
            variant="flat"
            onPress={() => open('stream')}
          >
            Create
          </Button>
        </div>
      </header>

      <section className="mx-auto">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Button
            className={filter === 'all' ? 'bg-white text-black' : 'border border-white/20 text-white/70'}
            size="sm"
            variant={filter === 'all' ? 'solid' : 'bordered'}
            onPress={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            className={filter === 'stream' ? 'bg-sky-500 text-white' : 'border border-white/20 text-white/70'}
            size="sm"
            startContent={<Video size={14} />}
            variant={filter === 'stream' ? 'solid' : 'bordered'}
            onPress={() => setFilter('stream')}
          >
            Stream
          </Button>
          <Button
            className={filter === 'ai' ? 'bg-emerald-500 text-white' : 'border border-white/20 text-white/70'}
            size="sm"
            startContent={<Sparkles size={14} />}
            variant={filter === 'ai' ? 'solid' : 'bordered'}
            onPress={() => setFilter('ai')}
          >
            AI
          </Button>
          <Button
            className={filter === 'call' ? 'bg-amber-500 text-white' : 'border border-white/20 text-white/70'}
            size="sm"
            startContent={<Users size={14} />}
            variant={filter === 'call' ? 'solid' : 'bordered'}
            onPress={() => setFilter('call')}
          >
            Calls
          </Button>
          <Button
            className={filter === 'file' ? 'bg-fuchsia-500 text-white' : 'border border-white/20 text-white/70'}
            size="sm"
            startContent={<FileText size={14} />}
            variant={filter === 'file' ? 'solid' : 'bordered'}
            onPress={() => setFilter('file')}
          >
            Files
          </Button>
        </div>
        {visibleInvites.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center text-white/60">
            <p className="font-[var(--font-feed-display)] text-lg text-white/80">No live sessions right now.</p>
            <p className="mt-2 text-sm text-white/50">Start one and it will show up here instantly.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleInvites.map((invite) => (
              <FeedCard
                key={invite.id}
                chatCount={chatCounts.get(invite.roomId) ?? 0}
                invite={invite}
                online={onlinePeers.get(invite.hostPeerId) ?? false}
                onOpen={handleOpenPreview}
                onShare={handleShare}
              />
            ))}
          </div>
        )}
      </section>
      <Modal isOpen={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <ModalContent className="bg-[#0c1018] text-white">
          {previewInvite ? (
            <>
              <ModalHeader className="flex flex-col gap-1">Live session preview</ModalHeader>
              <ModalBody>
                <FeedCard
                  chatCount={chatCounts.get(previewInvite.roomId) ?? 0}
                  invite={previewInvite}
                  online={onlinePeers.get(previewInvite.hostPeerId) ?? false}
                  onOpen={() => {}}
                  onShare={handleShare}
                />
              </ModalBody>
              <ModalFooter className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    isDisabled={visibleInvites.length <= 1}
                    variant="flat"
                    onPress={() =>
                      setPreviewIndex((prev) => (prev - 1 + visibleInvites.length) % visibleInvites.length)
                    }
                  >
                    Prev
                  </Button>
                  <Button
                    isDisabled={visibleInvites.length <= 1}
                    variant="flat"
                    onPress={() => setPreviewIndex((prev) => (prev + 1) % visibleInvites.length)}
                  >
                    Next
                  </Button>
                </div>
                <Button
                  as={Link}
                  className="rounded-full bg-white text-xs font-semibold uppercase tracking-[0.2em] text-black"
                  href={buildShareUrl(previewInvite.kind, previewInvite.roomId)}
                >
                  Join
                </Button>
              </ModalFooter>
            </>
          ) : null}
        </ModalContent>
      </Modal>
    </div>
  )
}
