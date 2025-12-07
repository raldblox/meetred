import React, { useMemo, useState } from 'react'
import { peerIdFromString } from '@libp2p/peer-id'
import Blockies from 'react-18-blockies'
import Link from 'next/link'
import { Button } from '@heroui/react'

import { PeerWrapper } from './peer'

import { StreamInvitePreview } from '@/components/stream/stream-preview'
import { StreamProvider } from '@/context/stream-ctx'
import { StreamInlineOverlay } from '@/components/stream/stream-inline-overlay'
import { StreamInlineViewer } from '@/components/stream/stream-inline-viewer'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { ChatMessage } from '@/context/chat-ctx'
import { useMarkAsRead } from '@/hooks/useMarkAsRead'
import { useStreamLiveStatus } from '@/hooks/useStreamLiveStatus'

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
  const isStreamHost = streamInvite ? libp2p.peerId.toString() === streamInvite.hostPeerId : false
  const streamStatus = useStreamLiveStatus(
    streamInvite && !isStreamHost ? streamInvite.hostPeerId : undefined,
    Boolean(streamInvite && !isStreamHost),
  )
  const [viewerOpen, setViewerOpen] = useState(false)

  const timestamp = new Date(receivedAt).toLocaleString()

  useMarkAsRead(msgId, peerId, read, dm)

  const bubbleClasses = isSelf
    ? 'bg-primary text-primary-foreground rounded-md rounded-tr-none'
    : 'bg-default-300 text-default-900 rounded-md rounded-tl-none'

  if (streamInvite) {
    const hostShortId = streamInvite.hostPeerId.slice(-7)

    return (
      <li className={`flex items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right' : 'text-left'}`}>
        {showAvatar ? (
          <div className="mt-5 w-8 h-8">
            <PeerWrapper key={peerIdStr} peer={peerIdObj} self={isSelf} withName={false} withUnread={false} />
          </div>
        ) : (
          <div className="w-8" />
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
          <div className="w-full max-w-sm">
            <div className="relative w-full p-2 shadow overflow-hidden rounded-lg bg-default-100 transition">
              <div className="flex items-start gap-3 p-1">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Stream invite</span>
                    {!isStreamHost && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          streamStatus.state === 'live'
                            ? 'bg-rose-100 text-rose-600'
                            : streamStatus.state === 'checking'
                              ? 'bg-default-200 text-default-600'
                              : 'bg-default-200 text-default-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            streamStatus.state === 'live' ? 'bg-rose-500 animate-pulse' : 'bg-default-500'
                          }`}
                        />
                        {streamStatus.state === 'live'
                          ? 'Live now'
                          : streamStatus.state === 'checking'
                            ? 'Checking'
                            : 'Offline'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase text-default-500">
                    <span className="flex items-center gap-1">
                      Host
                      <Blockies className="h-4 w-4 rounded-sm" scale={3} seed={streamInvite.hostPeerId} size={10} />
                      {hostShortId}
                    </span>
                  </div>
                </div>

                {isStreamHost ? (
                  <Button
                    as={Link}
                    className="font-semibold !text-sm"
                    color="success"
                    href={`/stream/${streamInvite.hostPeerId}`}
                    radius="full"
                    size="md"
                    variant="solid"
                  >
                    Start
                  </Button>
                ) : (
                  <Button
                    className="font-semibold !text-sm"
                    color="primary"
                    radius="full"
                    size="md"
                    variant="solid"
                    onPress={() => setViewerOpen(true)}
                  >
                    Watch
                  </Button>
                )}
              </div>

              {!isStreamHost && (
                <StreamProvider streamId={streamInvite.hostPeerId}>
                  <StreamInlineOverlay
                    open={viewerOpen}
                    streamId={streamInvite.hostPeerId}
                    onClose={() => setViewerOpen(false)}
                  >
                    <StreamInlineViewer />
                  </StreamInlineOverlay>
                  {streamStatus.state === 'live' && (
                    <div className="mt-2">
                      <StreamInvitePreview onClick={() => setViewerOpen(true)} />
                    </div>
                  )}
                  {streamStatus.state === 'checking' && (
                    <p className="mt-3 text-[11px] uppercase tracking-wide text-default-400">
                      Checking if host is live...
                    </p>
                  )}
                  {streamStatus.state === 'offline' && (
                    <p className="mt-3 text-[11px] uppercase tracking-wide text-default-400">
                      Preview will appear once the host goes live.
                    </p>
                  )}
                </StreamProvider>
              )}
            </div>
          </div>
        </div>
      </li>
    )
  }

  if (meetingInvite) {
    const hostShortId = meetingInvite.hostPeerId.slice(-7)

    return (
      <li className={`flex items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right' : 'text-left'}`}>
        {showAvatar ? (
          <div className="mt-5 w-8 h-8">
            <PeerWrapper key={peerIdStr} peer={peerIdObj} self={isSelf} withName={false} withUnread={false} />
          </div>
        ) : (
          <div className="w-8" />
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
          <div className="w-full max-w-xl">
            <div
              className={`relative min-w-xs shadow overflow-hidden rounded-lg  transition  ${isSelf ? 'bg-default-100' : 'bg-default-100'} `}
            >
              <div className="flex items-start gap-3 p-4">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Private call
                      {/* {`Meeting with ${isSelf ? 'you' : hostShortId}`} */}
                    </span>
                    {/* <span className="text-[11px] font-medium text-default-500">{meetingTimeLabel}</span> */}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-default-400 text-[11px] flex gap-1 uppercase">
                      Hosted by{' '}
                      <Blockies className="h-4 w-4 rounded-sm" scale={3} seed={meetingInvite.hostPeerId} size={10} />
                      {hostShortId}
                    </span>
                  </div>
                </div>

                <Button
                  as={Link}
                  className="font-semibold !text-sm"
                  color="success"
                  href={`/room/${meetingInvite.roomId}`}
                  radius="full"
                  size="md"
                  variant="solid"
                >
                  Join
                </Button>
              </div>
            </div>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className={`flex items-start gap-x-2 ${isSelf ? 'flex-row-reverse text-right' : 'text-left'}`}>
      {showAvatar ? (
        <div className="mt-5 w-8 h-8">
          <PeerWrapper key={peerIdStr} peer={peerIdObj} self={isSelf} withName={false} withUnread={false} />
        </div>
      ) : (
        <div className="w-8" />
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
      </div>
    </li>
  )
}
