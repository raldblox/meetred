import React from 'react'
import { peerIdFromString } from '@libp2p/peer-id'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/ctx'
import { ChatMessage } from '@/context/chat-ctx'
import { useMarkAsRead } from '@/hooks/useMarkAsRead'

interface Props extends ChatMessage {
  dm: boolean
  showTimestamp?: boolean
  showAvatar?: boolean
}

export const Message = ({
  msgId,
  msg,
  fileObjectUrl,
  peerId,
  read,
  dm,
  receivedAt,
  showTimestamp = true,
  showAvatar = true,
}: Props) => {
  const { libp2p } = useLibp2pContext()

  const isSelf: boolean = libp2p.peerId.equals(peerId)

  const timestamp = new Date(receivedAt).toLocaleString()

  useMarkAsRead(msgId, peerId, read, dm)

  const bubbleClasses = isSelf
    ? 'bg-primary text-primary-foreground rounded-md rounded-tr-none'
    : 'bg-default-300 text-default-900 rounded-md rounded-tl-none'

  return (
    <li className={`flex items-start gap-x-3 ${isSelf ? 'flex-row-reverse text-right' : 'text-left'}`}>
      {showAvatar ? (
        <div className="mt-6 w-8 h-8">
          <PeerWrapper key={peerId} peer={peerIdFromString(peerId)} self={isSelf} withName={false} withUnread={false} />
        </div>
      ) : (
        <div className="w-8" />
      )}
      <div className={`flex flex-col max-w-2xl ${isSelf ? 'items-end' : 'items-start'}`}>
        {showTimestamp && (
          <div
            className={`flex h-6 items-center gap-2 text-[10px] uppercase tracking-wide text-default-400 ${isSelf ? 'justify-end' : ''}`}
          >
            {!isSelf && <span className="text-default-500">{peerId.slice(-6)}</span>}
            {showTimestamp && <span>{timestamp}</span>}
          </div>
        )}

        <div className={`px-4 py-2 shadow-md relative ${bubbleClasses}`}>
          <p className="break-words whitespace-pre-wrap text-sm">{msg}</p>
          {fileObjectUrl && (
            <div className="mt-2 text-sm underline underline-offset-2">
              <a href={fileObjectUrl} rel="noreferrer" target="_blank">
                Download
              </a>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
