'use client'

import { useEffect, useState } from 'react'
import { PeerId } from '@libp2p/interface'
import Blockies from 'react-18-blockies'

import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'

export interface PeerProps {
  peer: PeerId
  self: boolean
  withName: boolean
  withUnread: boolean
}

export function PeerWrapper({ peer, self, withName, withUnread }: PeerProps) {
  const { libp2p } = useLibp2pContext()
  const [identified, setIdentified] = useState(false)
  const { setRoomId } = useChatContext()

  const handleSetRoomId = () => {
    setRoomId(peer.toString())
  }

  useEffect(() => {
    const init = async () => {
      if (await libp2p.peerStore.has(peer)) {
        const p = await libp2p.peerStore.get(peer)

        if (p.protocols.length > 0) {
          setIdentified(true)
        }
      }
    }

    init()
  }, [libp2p.peerStore, peer])

  if (self || !identified) {
    return <Peer peer={peer} self={self} withName={withName} withUnread={withUnread} />
  }

  if (identified && libp2p.services.directMessage.isDMPeer(peer)) {
    return (
      <button
        className="relative inline-flex w-full items-stretch text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-default-400"
        type="button"
        onClick={handleSetRoomId}
      >
        <span className="sr-only">Open direct message</span>
        <Peer peer={peer} self={self} withName={withName} withUnread={withUnread} />
      </button>
    )
  }

  if (identified && !libp2p.services.directMessage.isDMPeer(peer)) {
    return (
      <div className="relative inline-block text-left group">
        <Peer peer={peer} self={self} withName={withName} withUnread={withUnread} />
        <div className="absolute top-10 left-5 scale-0 rounded-lg bg-default-50 border border-default-100 text-default-600 p-2 text-xs group-hover:scale-100 z-10">
          Direct{'\u00A0'}message unsupported
        </div>
      </div>
    )
  }
}

export function Peer({ peer, self, withName, withUnread }: PeerProps) {
  const { directMessages } = useChatContext()

  return (
    <div className="flex items-center h-10 text-sm transition duration-150 ease-in-out focus:outline-none relative text-left">
      <Blockies className="rounded h-8" scale={3} seed={peer.toString()} size={12} />
      {withName && (
        <div className="w-full">
          <div className="flex">
            <span className={`block ml-2 uppercase font-semibold ${self ? 'text-primary' : 'text-default-600'}`}>
              {peer.toString().slice(-7)}
              {self && ' (You)'}
            </span>
          </div>
          {withUnread && (
            <div className="ml-2 text-default-600">
              {directMessages[peer.toString()]?.filter((m) => !m.read).length
                ? `(${directMessages[peer.toString()]?.filter((m) => !m.read).length} unread)`
                : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
