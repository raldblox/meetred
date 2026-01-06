'use client'

import type { PeerId } from '@libp2p/interface'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { peerIdFromString } from '@libp2p/peer-id'
import { RefreshCw } from 'lucide-react'
import { Button } from '@heroui/react'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { useChatContext } from '@/context/chat-ctx'
import { BOOTSTRAP_PEER_IDS, CHAT_TOPIC } from '@/config/constants'
import { PUBLIC_CHAT_ROOM_ID } from '@/components/chat/chat-room'

interface ChatPeerListProps {
  hideHeader?: boolean
}

export function ChatPeerList({ hideHeader = false }: ChatPeerListProps) {
  const { libp2p, refreshPeerDiscovery } = useLibp2pContext()
  const { roomId, historySyncingPeerIds } = useChatContext()
  const [subscribers, setSubscribers] = useState<string[]>([])
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [seenPeers, setSeenPeers] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  const refreshPeers = useCallback(async () => {
    if (refreshing) {
      return
    }

    setRefreshing(true)

    try {
      await refreshPeerDiscovery()
    } finally {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
      refreshTimeoutRef.current = setTimeout(() => {
        setRefreshing(false)
      }, 900)
    }
  }, [refreshPeerDiscovery, refreshing])

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

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const peerIds = Array.from(
    new Set([
      ...connectedPeers,
      ...subscribers.filter((peer) => peer !== ''),
      ...seenPeers, // peers we have seen publish messages, even if not yet connected
    ]),
  )

  return (
    <div className="lg:col-span-1 h-full">
      {!hideHeader && (
        <div className="flex h-12 pr-2 items-center justify-between rounded-sm hover:bg-gradient-to-l from-zinc-900 to-transparent">
          <h2 className="text-lg font-semibold text-default-800">Peers</h2>
          <Button
            isIconOnly
            aria-label="Refresh peers"
            color={refreshing ? 'success' : 'default'}
            size="sm"
            variant="light"
            onPress={refreshPeers}
          >
            <RefreshCw className={`h-4 w-4 opacity-50 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      )}

      <div className="overflow-auto h-full select-none">
        <div className="transition-all flex items-center py-1.5 rounded-sm select-none hover:bg-gradient-to-l from-zinc-900 to-transparent">
          {<PeerWrapper self peer={libp2p.peerId} withName={true} withUnread={false} />}
        </div>

        {peerIds.length === 0 && <div className="px-3 text-xs text-default-500">No peers connected yet.</div>}
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
                className={`transition-all rounded-sm flex py-1.5 items-center hover:pl-3 select-none ${isSelected ? 'border-primary px-1.5 bg-gradient-to-l from-zinc-800 to-transparent' : 'border-primary/50 hover:bg-gradient-to-l from-zinc-900 to-transparent'}`}
              >
                <PeerWrapper
                  peer={id}
                  self={false}
                  showCountBadge={roomId === PUBLIC_CHAT_ROOM_ID}
                  syncing={historySyncingPeerIds.includes(p)}
                  withName={true}
                  withUnread={true}
                />
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
