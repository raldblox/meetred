import React, { useMemo, useState } from 'react'
import { peerIdFromString } from '@libp2p/peer-id'
import Blockies from 'react-18-blockies'
import Link from 'next/link'
import { Button } from '@heroui/react'
import clsx from 'clsx'

import { PeerWrapper } from './peer'

import { StreamInvitePreview } from '@/components/stream/stream-preview'
import { StreamProvider } from '@/context/stream-ctx'
import { StreamInlineOverlay } from '@/components/stream/stream-inline-overlay'
import { StreamInlineViewer } from '@/components/stream/stream-inline-viewer'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { ChatMessage } from '@/context/chat-ctx'
import { useMarkAsRead } from '@/hooks/useMarkAsRead'
import { useStreamLiveStatus } from '@/hooks/useStreamLiveStatus'
import { parseStreamChatPayload } from '@/lib/stream-chat'
import { INVITE_CARD_COPY, type InviteStatus } from '@/config/copy'

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
    // Non-JSON messages are ignored
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
    // ignore
  }

  return null
}

interface Props extends ChatMessage {
  dm: boolean
  showTimestamp?: boolean
  showAvatar?: boolean
}

export const Message = ({
  msgId,
  msg,
  fileObjectUrl,
  fileName,
  peerId,
  read,
  dm,
  receivedAt,
  status,
  showTimestamp = true,
  showAvatar = true,
}: Props) => {
  const { libp2p } = useLibp2pContext()

  const peerIdStr = peerId?.toString?.() ?? peerId
  let peerIdObj

  try {
    peerIdObj = peerIdFromString(peerIdStr)
  } catch {
    peerIdObj = libp2p.peerId
  }
  const isSelf: boolean = libp2p.peerId.toString() === peerIdStr

  const meetingInvite = useMemo(() => parseMeetingInvite(msg), [msg])
  const streamInvite = useMemo(() => parseStreamInvite(msg), [msg])
  const streamChatPayload = useMemo(() => parseStreamChatPayload(msg), [msg])
  const agentInvite = useMemo(() => parseAgentInvite(msg), [msg])
  const isStreamHost = streamInvite ? libp2p.peerId.toString() === streamInvite.hostPeerId : false
  const streamStatus = useStreamLiveStatus(
    streamInvite && !isStreamHost ? streamInvite.hostPeerId : undefined,
    Boolean(streamInvite && !isStreamHost),
  )
  const [viewerOpen, setViewerOpen] = useState(false)

  const timestamp = new Date(receivedAt).toLocaleString()
  const deliveryStatus = status ?? 'sent'
  const isPending = deliveryStatus === 'pending'
  const isFailed = deliveryStatus === 'failed'

  useMarkAsRead(msgId, peerId, read, dm)

  const bubbleClasses = clsx(
    isSelf
      ? 'bg-primary text-primary-foreground rounded-md rounded-tr-none !ml-6'
      : 'bg-default-300 text-default-900 rounded-md rounded-tl-none !mr-6',
    isSelf && isPending && 'opacity-70',
    isSelf && isFailed && 'bg-danger/80 text-danger-foreground',
  )
  const inviteShellClass = 'w-full min-w-[280px] max-w-xl '
  const inviteCardClass =
    'relative w-full overflow-hidden rounded-xl bg-default-100 border border-default-200 p-4 shadow-sm'

  if (streamInvite) {
    const hostShortId = streamInvite.hostPeerId.slice(-7)
    const streamStatusKey: InviteStatus = streamStatus.state === 'live' ? 'live' : isStreamHost ? 'ready' : 'waiting'
    const streamCopy = INVITE_CARD_COPY.stream[streamStatusKey]

    if (isStreamHost) {
      return (
        <li className={`flex items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right' : 'text-left'}`}>
          {showAvatar ? (
            <div className="mt-5 w-8 h-8">
              <PeerWrapper
                key={peerIdStr}
                peer={peerIdObj}
                self={isSelf}
                showCountBadge={!dm}
                withName={false}
                withUnread={false}
              />
            </div>
          ) : (
            <div className="w-8" />
          )}
          <div className={`flex flex-col text-left ${isSelf ? 'items-end ' : 'items-start'}`}>
            {showTimestamp && (
              <div
                className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-end' : ''}`}
              >
                {!isSelf && <span className="text-default-500">{peerId.slice(-7)}</span>}
                {showTimestamp && <span>{timestamp}</span>}
              </div>
            )}
            <div className={inviteShellClass}>
              <div className={inviteCardClass}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-default-400">{streamCopy.label}</p>
                    <p className="text-lg uppercase text-left font-semibold">{streamCopy.title(hostShortId)}</p>
                  </div>
                  <Button
                    as={Link}
                    className="font-semibold !text-sm"
                    color="primary"
                    href={`/stream/${streamInvite.hostPeerId}`}
                    radius="full"
                    size="md"
                    variant="solid"
                  >
                    {streamCopy.cta}
                  </Button>
                </div>
                <p className="mt-3 text-sm text-left text-default-500">{streamCopy.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] uppercase text-default-500">
                  <span className="flex items-center gap-1">
                    Host
                    <Blockies className="h-4 w-4 rounded-sm" scale={10} seed={streamInvite.hostPeerId} size={8} />
                    {hostShortId}
                  </span>
                  {streamCopy.meta && <span className="text-default-400">{streamCopy.meta}</span>}
                </div>
              </div>
            </div>
            {isSelf && deliveryStatus !== 'sent' && (
              <span
                className={clsx(
                  'mt-1 text-[10px] uppercase tracking-wide',
                  isFailed ? 'text-danger' : 'text-default-400',
                )}
              >
                {isPending ? 'Sending...' : 'Failed to send'}
              </span>
            )}
          </div>
        </li>
      )
    }

    return (
      <li className={`flex items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right ml-10' : 'text-left mr-10'}`}>
        {showAvatar ? (
          <div className="mt-5 w-8 h-8">
            <PeerWrapper
              key={peerIdStr}
              peer={peerIdObj}
              self={isSelf}
              showCountBadge={!dm}
              withName={false}
              withUnread={false}
            />
          </div>
        ) : (
          <div className="w-8" />
        )}
        <div className={`flex flex-col ${inviteShellClass} ${isSelf ? 'items-end' : 'items-start'}`}>
          {showTimestamp && (
            <div
              className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-end' : ''}`}
            >
              {!isSelf && <span className="text-default-500">{peerId.slice(-7)}</span>}
              {showTimestamp && <span>{timestamp}</span>}
            </div>
          )}
          <StreamProvider streamId={streamInvite.hostPeerId}>
            <StreamInlineOverlay
              open={viewerOpen}
              streamId={streamInvite.hostPeerId}
              onClose={() => setViewerOpen(false)}
            >
              <StreamInlineViewer />
            </StreamInlineOverlay>
            <div className="w-full">
              <StreamInvitePreview
                ctaLabel={streamCopy.cta}
                description={streamCopy.body}
                hostPeerId={streamInvite.hostPeerId}
                status={streamStatus.state}
                title={streamCopy.title(hostShortId)}
                onClick={() => setViewerOpen(true)}
              />
            </div>
          </StreamProvider>
        </div>
        {isSelf && deliveryStatus !== 'sent' && (
          <span
            className={clsx('mt-1 text-[10px] uppercase tracking-wide', isFailed ? 'text-danger' : 'text-default-400')}
          >
            {isPending ? 'Sending...' : 'Failed to send'}
          </span>
        )}
      </li>
    )
  }

  if (streamChatPayload) {
    const hostShortId = streamChatPayload.hostPeerId.slice(-7)

    return (
      <li
        className={`flex items-start min-w-[250px]  gap-x-2 ${isSelf ? 'flex-row-reverse text-right ml-10' : 'text-left mr-10'}`}
      >
        {showAvatar ? (
          <div className="mt-5 w-8 h-8">
            <PeerWrapper
              key={peerIdStr}
              peer={peerIdObj}
              self={isSelf}
              showCountBadge={!dm}
              withName={false}
              withUnread={false}
            />
          </div>
        ) : (
          <div className="w-8" />
        )}
        <div className={`flex flex-col max-w-md min-w-md ${isSelf ? 'items-end' : 'items-start'}`}>
          {showTimestamp && (
            <div
              className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-end' : ''}`}
            >
              {!isSelf && <span className="text-default-500">{peerId.slice(-7)}</span>}
              {showTimestamp && <span>{timestamp}</span>}
            </div>
          )}
          <div className="bg-default-100 rounded-lg overflow-hidden">
            <div className="px-3 gap-6 justify-between flex items-center p-2 w-full  shadow-md">
              <p className="text-xs uppercase text-default-500">STREAM: {hostShortId}</p>
              <div className="flex items-center justify-between gap-3">
                <Link
                  className="rounded-full border border-default-300 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-default-600 hover:text-success"
                  href={`/stream/${streamChatPayload.hostPeerId}`}
                >
                  JOIN
                </Link>
              </div>
            </div>
            <div className="w-full bg-default-50 px-3 p-2 shadow-sm">
              <p className="text-sm text-default-700 whitespace-pre-wrap break-words">{streamChatPayload.body}</p>
            </div>
          </div>
        </div>
        {isSelf && deliveryStatus !== 'sent' && (
          <span
            className={clsx('mt-1 text-[10px] uppercase tracking-wide', isFailed ? 'text-danger' : 'text-default-400')}
          >
            {isPending ? 'Sending...' : 'Failed to send'}
          </span>
        )}
      </li>
    )
  }

  if (meetingInvite) {
    const hostShortId = meetingInvite.hostPeerId.slice(-7)
    const callCopy = INVITE_CARD_COPY.call.ready

    return (
      <li className={`flex text-left items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right ml-10' : 'mr-10'}`}>
        {showAvatar ? (
          <div className="mt-5 w-8 h-8">
            <PeerWrapper
              key={peerIdStr}
              peer={peerIdObj}
              self={isSelf}
              showCountBadge={!dm}
              withName={false}
              withUnread={false}
            />
          </div>
        ) : (
          <div className="w-8" />
        )}
        <div className={`flex text-left flex-col ${inviteShellClass} ${isSelf ? 'items-end' : 'items-start'}`}>
          {showTimestamp && (
            <div
              className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-end' : ''}`}
            >
              {!isSelf && <span className="text-default-500">{peerId.slice(-7)}</span>}
              {showTimestamp && <span>{timestamp}</span>}
            </div>
          )}
          <div className="w-full">
            <div className={inviteCardClass}>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-default-400">{callCopy.label}</p>
                  <p className="text-lg font-semibold uppercase text-foreground">{callCopy.title(hostShortId)}</p>
                  <p className="text-sm text-default-600">{callCopy.body}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase text-default-500">
                    <span className="flex items-center gap-1">
                      Hosted by
                      <Blockies className="h-4 w-4 rounded-sm" scale={10} seed={meetingInvite.hostPeerId} size={8} />
                      {hostShortId}
                    </span>
                    {callCopy.meta && <span className="text-default-400">{callCopy.meta}</span>}
                  </div>
                </div>

                <Button
                  as={Link}
                  className="font-semibold !text-sm"
                  color="success"
                  href={`/call/${meetingInvite.roomId}`}
                  radius="full"
                  size="md"
                  variant="solid"
                >
                  {callCopy.cta}
                </Button>
              </div>
            </div>
          </div>
          {isSelf && deliveryStatus !== 'sent' && (
            <span
              className={clsx(
                'mt-1 text-[10px] uppercase tracking-wide',
                isFailed ? 'text-danger' : 'text-default-400',
              )}
            >
              {isPending ? 'Sending...' : 'Failed to send'}
            </span>
          )}
        </div>
      </li>
    )
  }

  if (agentInvite) {
    const agentShortId = agentInvite.agentPeerId.slice(-7)
    const aiCopy = INVITE_CARD_COPY.ai.ready

    return (
      <li className={`flex items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right ml-10' : 'text-left mr-10'}`}>
        {showAvatar ? (
          <div className="mt-5 w-8 h-8">
            <PeerWrapper
              key={peerIdStr}
              peer={peerIdObj}
              self={isSelf}
              showCountBadge={!dm}
              withName={false}
              withUnread={false}
            />
          </div>
        ) : (
          <div className="w-8" />
        )}
        <div className={`flex flex-col ${inviteShellClass} ${isSelf ? 'items-end' : 'items-start'}`}>
          {showTimestamp && (
            <div
              className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-ends' : ''}`}
            >
              {!isSelf && <span className="text-default-500">{peerId.slice(-7)}</span>}
              <span>{timestamp}</span>
            </div>
          )}
          <div className="w-full">
            <div className={inviteCardClass}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] text-left uppercase tracking-[0.3em] text-default-400">{aiCopy.label}</p>
                  <p className="text-lg text-left font-semibold uppercase">{aiCopy.title(agentShortId)}</p>
                </div>
                <Button
                  as={Link}
                  className="font-semibold !text-sm"
                  color="secondary"
                  href={`/agent/${agentInvite.agentPeerId}`}
                  radius="full"
                  size="md"
                  variant="solid"
                >
                  {aiCopy.cta}
                </Button>
              </div>
              <p className="mt-2 text-sm text-left text-default-500">{aiCopy.body}</p>
              {aiCopy.meta && <p className="text-[11px] uppercase text-default-400 mt-2">{aiCopy.meta}</p>}
            </div>
          </div>
          {isSelf && deliveryStatus !== 'sent' && (
            <span
              className={clsx(
                'mt-1 text-[10px] uppercase tracking-wide',
                isFailed ? 'text-danger' : 'text-default-400',
              )}
            >
              {isPending ? 'Sending...' : 'Failed to send'}
            </span>
          )}
        </div>
      </li>
    )
  }

  return (
    <li className={`flex items-start gap-x-2 text-left ${isSelf ? 'flex-row-reverse ml-10' : 'mr-10'}`}>
      {showAvatar ? (
        <div className="mt-5 w-8 h-8">
          <PeerWrapper
            key={peerIdStr}
            peer={peerIdObj}
            self={isSelf}
            showCountBadge={!dm}
            withName={false}
            withUnread={false}
          />
        </div>
      ) : (
        <div className="!w-8 !h-8 aspect-square" />
      )}
      <div className={`flex flex-col max-w-2xl ${isSelf ? 'items-end' : 'items-start'}`}>
        {showTimestamp && (
          <div
            className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-end' : ''}`}
          >
            {!isSelf && <span className="text-default-500">{peerId.slice(-7)}</span>}
            {showTimestamp && <span>{timestamp}</span>}
          </div>
        )}

        <div className={`px-4 py-2 shadow-md relative ${bubbleClasses}`}>
          <p className="break-words whitespace-pre-wrap text-sm">{msg}</p>
          {fileObjectUrl && (
            <div className="mt-2 text-sm underline underline-offset-2">
              <a download={fileName ?? 'download'} href={fileObjectUrl} rel="noreferrer">
                Download
              </a>
            </div>
          )}
        </div>
        {isSelf && deliveryStatus !== 'sent' && (
          <span
            className={clsx('mt-1 text-[10px] uppercase tracking-wide', isFailed ? 'text-danger' : 'text-default-400')}
          >
            {isPending ? 'Sending...' : 'Failed to send'}
          </span>
        )}
      </div>
    </li>
  )
}
