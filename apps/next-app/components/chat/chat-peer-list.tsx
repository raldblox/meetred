'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { peerIdFromString } from '@libp2p/peer-id'
import { RefreshCw } from 'lucide-react'
import { Button } from '@heroui/react'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { useChatContext } from '@/context/chat-ctx'
import { useSpecialPeers } from '@/hooks/useSpecialPeers'
import { PUBLIC_CHAT_ROOM_ID } from '@/components/chat/chat-room'
import { usePeerPresence } from '@/hooks/usePeerPresence'

interface ChatPeerListProps {
  hideHeader?: boolean
}

export function ChatPeerList({ hideHeader = false }: ChatPeerListProps) {
  const { libp2p, refreshPeerDiscovery } = useLibp2pContext()
  const { roomId, historySyncingPeerIds } = useChatContext()
  const [refreshing, setRefreshing] = useState(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const peers = usePeerPresence()
  const specialPeers = useSpecialPeers()

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
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const peerIds = Array.from(new Set(peers.map((peer) => peer.peerId)))

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

        {peerIds.length === 0 && <div className="text-xs text-default-500">No peers connected yet.</div>}
        {peerIds.map((p) => {
          if (p === libp2p.peerId.toString()) {
            return null
          }

          try {
            const id = peerIdFromString(p)
            const isSelected = roomId === p
            const specialKind = specialPeers[p]

            return (
              <div
                key={p}
                className={`transition-all animate-appearance-in rounded-sm flex py-1.5 items-center hover:pl-3 select-none ${isSelected ? 'border-primary px-1.5 bg-gradient-to-l from-zinc-800 to-transparent' : 'border-primary/50 hover:bg-gradient-to-l from-zinc-900 to-transparent'}`}
              >
                <PeerWrapper
                  peer={id}
                  self={false}
                  showCountBadge={roomId === PUBLIC_CHAT_ROOM_ID}
                  syncing={historySyncingPeerIds.includes(p)}
                  withName={true}
                  withUnread={true}
                  label={specialKind}
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
