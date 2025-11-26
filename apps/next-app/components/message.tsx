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

  return (
    <li className={`flex ${isSelf && 'flex-row-reverse'} gap-2`}>
      <PeerWrapper key={peerId} peer={peerIdFromString(peerId)} self={isSelf} withName={false} withUnread={false} />
      <div className="flex relative max-w-xl px-4 py-2 text-default-700 rounded shadow bg-background">
        <div className="block">
          {msg}
          <p>
            {fileObjectUrl ? (
              <a href={fileObjectUrl} rel="noreferrer" target="_blank">
                <b>Download</b>
              </a>
            ) : (
              ''
            )}
          </p>
          <p className="italic text-default-400">
            {!dm && peerId !== libp2p.peerId.toString() ? `from: ${peerId.slice(-4)}` : null}{' '}
          </p>
          <span className="relative pl-1 text-xs text-default-400">{timestamp}</span>
        </div>
      </div>
    </li>
  )
}
