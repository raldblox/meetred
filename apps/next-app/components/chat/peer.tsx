'use client'

import { useEffect, useState } from 'react'
import { PeerId } from '@libp2p/interface'
import Blockies from 'react-18-blockies'
import { Loader2 } from 'lucide-react'

import { useChatContext } from '@/context/chat-ctx'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { PUBLIC_CHAT_ROOM_ID } from '@/components/chat/chat-room'

export interface PeerProps {
  peer: PeerId
  self: boolean
  withName: boolean
  withUnread: boolean
  syncing?: boolean
}

export function PeerWrapper({ peer, self, withName, withUnread, syncing = false }: PeerProps) {
  const { libp2p } = useLibp2pContext()
  const [identified, setIdentified] = useState(false)
  const { setRoomId } = useChatContext()

  const handleSetRoomId = () => {
    if (self) {
      setRoomId(PUBLIC_CHAT_ROOM_ID)
    } else {
      setRoomId(peer.toString())
    }
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

  const body = <Peer peer={peer} self={self} syncing={syncing} withName={withName} withUnread={withUnread} />
  const canDirectMessage = identified && libp2p.services.directMessage.isDMPeer(peer)

  const clickableBody = (
    <button
      className="relative cursor-pointer transition-all hover:saturate-150 inline-flex w-full items-stretch text-left focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-default-400"
      type="button"
      onClick={handleSetRoomId}
    >
      <span className="sr-only">Open direct message</span>
      {body}
    </button>
  )

  if (self || canDirectMessage) {
    return clickableBody
  }

  // Still allow opening the DM view even if the identify/DM handshake is pending, but avoid hover popups.
  return clickableBody
}

export function Peer({ peer, self, withName, withUnread, syncing = false }: PeerProps) {
  const { directMessages } = useChatContext()

  return (
    <div className="flex h-10 items-center text-sm transition duration-150 ease-in-out focus:outline-none relative text-left">
      <Blockies className="h-8 rounded-sm" scale={4} seed={peer.toString()} size={8} />
      {/* <Badge color="success" content="" placement="bottom-right" shape="rectangle" size="sm">
        <Blockies className="rounded-sm h-5" scale={3} seed={peer.toString()} size={12} />
      </Badge> */}

      {withName && (
        <div className="w-full">
          <div className="flex items-center gap-1">
            <span className={`block ml-2 uppercase font-semibold ${self ? 'text-primary' : 'text-default-600'}`}>
              {peer.toString().slice(-7)}
              {self && ' (You)'}
            </span>
            {syncing && (
              <Loader2 aria-label="Syncing history" className="h-3.5 w-3.5 animate-spin text-primary" />
            )}
          </div>
          {withUnread && (
            <div className="ml-2 text-xs text-success-600">
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
