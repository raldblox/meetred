'use client'

import type { PeerId } from '@libp2p/interface'

import React, { useCallback, useEffect, useState } from 'react'
import { peerIdFromString } from '@libp2p/peer-id'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { useChatContext } from '@/context/chat-ctx'
import { BOOTSTRAP_PEER_IDS, CHAT_TOPIC } from '@/config/constants'

interface ChatPeerListProps {
  hideHeader?: boolean
}

export function ChatPeerList({ hideHeader = false }: ChatPeerListProps) {
  const { libp2p } = useLibp2pContext()
  const { roomId } = useChatContext()
  const [subscribers, setSubscribers] = useState<string[]>([])
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [seenPeers, setSeenPeers] = useState<string[]>([])

  useEffect(() => {
    const onSubscriptionChange = () => {
      const peers = libp2p.services.pubsub.getSubscribers(CHAT_TOPIC) as unknown as PeerId[]

      setSubscribers(peers.map((peer) => peer.toString()))
    }

    onSubscriptionChange()
    libp2p.services.pubsub.addEventListener('subscription-change', onSubscriptionChange)

    return () => {
      libp2p.services.pubsub.removeEventListener('subscription-change', onSubscriptionChange)
    }
  }, [libp2p])

  useEffect(() => {
    const onMessage = (evt: CustomEvent) => {
      const from = (evt.detail?.from as PeerId | undefined)?.toString()

      if (!from || from === libp2p.peerId.toString()) {
        return
      }

      setSeenPeers((prev) => {
        if (prev.includes(from)) {
          return prev
        }

        return [...prev, from]
      })
    }

    libp2p.services.pubsub.addEventListener('message', onMessage)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', onMessage)
    }
  }, [libp2p, setSeenPeers])

  const updateConnections = useCallback(() => {
    const ids = libp2p
      .getConnections()
      .map((conn) => conn.remotePeer.toString())
      .filter((peerId) => peerId !== libp2p.peerId.toString() && !BOOTSTRAP_PEER_IDS.includes(peerId))

    setConnectedPeers(Array.from(new Set(ids)))
  }, [libp2p])

  useEffect(() => {
    updateConnections()

    const onOpen = () => updateConnections()
    const onClose = () => updateConnections()

    libp2p.addEventListener('connection:open', onOpen)
    libp2p.addEventListener('connection:close', onClose)

    return () => {
      libp2p.removeEventListener('connection:open', onOpen)
      libp2p.removeEventListener('connection:close', onClose)
    }
  }, [libp2p, updateConnections])

  const peerIds = Array.from(
    new Set([
      ...connectedPeers,
      ...subscribers.filter((peer) => peer !== ''),
      ...seenPeers, // peers we have seen publish messages, even if not yet connected
    ]),
  )

  return (
    <div className="border-default-100 lg:col-span-1 h-full">
      {!hideHeader && (
        <h2 className="text-sm h-10 flex items-center font-semibold py-2 border-b border-default-100 px-5 text-default-800">
          Peers
        </h2>
      )}

      <div className="overflow-auto space-y-0.5 py-2 px-2 h-full">
        <div className="hover:bg-primary/20 flex items-center py-1 px-3 select-none">
          {<PeerWrapper self peer={libp2p.peerId} withName={true} withUnread={false} />}
        </div>

        {peerIds.length === 0 && <div className="px-3 py-1 text-xs text-default-500">No peers connected yet.</div>}
        {peerIds.map((p) => {
          if (BOOTSTRAP_PEER_IDS.includes(p) || p === libp2p.peerId.toString()) {
            return null
          }

          try {
            const id = peerIdFromString(p)
            const isSelected = roomId === p

            return (
              <div
                key={p}
                className={`flex items-center py-1 px-3 hover:bg-primary/20 select-none ${isSelected ? 'bg-primary/50' : ''}`}
              >
                <PeerWrapper peer={id} self={false} withName={true} withUnread={true} />
              </div>
            )
          } catch {
            return null
          }
        })}
      </div>
    </div>
  )
}
