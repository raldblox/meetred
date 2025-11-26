import React from 'react'
import { peerIdFromString } from '@libp2p/peer-id'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/ctx'
import { ChatMessage } from '@/context/chat-ctx'
import { useMarkAsRead } from '@/hooks/useMarkAsRead'

interface Props extends ChatMessage {
  dm: boolean
}

export const Message = ({ msgId, msg, fileObjectUrl, peerId, read, dm, receivedAt }: Props) => {
  const { libp2p } = useLibp2pContext()

  const isSelf: boolean = libp2p.peerId.equals(peerId)

  const timestamp = new Date(receivedAt).toLocaleString()

  useMarkAsRead(msgId, peerId, read, dm)

  const bubbleClasses = isSelf
    ? 'bg-primary text-primary-foreground rounded-md rounded-tr-none'
    : 'bg-default-300 text-default-900 rounded-md rounded-tl-none'

  return (
    <li className={`flex items-start gap-3 ${isSelf ? 'flex-row-reverse text-right' : 'text-left'}`}>
      <div className="mt-7">
        <PeerWrapper key={peerId} peer={peerIdFromString(peerId)} self={isSelf} withName={false} withUnread={false} />
      </div>
      <div className={`flex flex-col max-w-2xl ${isSelf ? 'items-end' : 'items-start'}`}>
        <div className={`flex h-7 items-center gap-2 text-xs text-default-400 ${isSelf ? 'justify-end' : ''}`}>
          {!isSelf && <span className="font-semibold text-default-500">{peerId.slice(-6)}</span>}
          <span>{timestamp}</span>
        </div>
        <div className={`px-3 py-1 shadow-md relative ${bubbleClasses}`}>
          <p className="break-words whitespace-pre-wrap">{msg}</p>
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
