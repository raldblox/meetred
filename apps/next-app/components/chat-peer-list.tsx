'use client'

import type { PeerId } from '@libp2p/interface'

import React, { useEffect, useState } from 'react'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CHAT_TOPIC, BOOTSTRAP_PEER_IDS } from '@/lib/constants'

interface ChatPeerListProps {
  hideHeader?: boolean
}

export function ChatPeerList({ hideHeader = false }: ChatPeerListProps) {
  const { libp2p } = useLibp2pContext()
  const [subscribers, setSubscribers] = useState<PeerId[]>([])

  useEffect(() => {
    const onSubscriptionChange = () => {
      // libp2p currently exports PeerId types from different packages, so narrow via unknown first
      const peers = libp2p.services.pubsub.getSubscribers(CHAT_TOPIC) as unknown as PeerId[]

      setSubscribers(peers)
    }

    onSubscriptionChange()
    libp2p.services.pubsub.addEventListener('subscription-change', onSubscriptionChange)

    return () => {
      libp2p.services.pubsub.removeEventListener('subscription-change', onSubscriptionChange)
    }
  }, [libp2p, setSubscribers])

  return (
    <div className="border-default-100 lg:col-span-1 h-full">
      {!hideHeader && (
        <h2 className="text-sm h-10 flex items-center font-semibold py-2 px-3 border-b border-default-100 text-default-800">
          Peers
        </h2>
      )}
      <div className="overflow-auto h-full">
        <div className="hover:bg-default-100 flex items-center py-2 px-3">
          {<PeerWrapper self peer={libp2p.peerId} withName={true} withUnread={false} />}
        </div>

        {subscribers.map((p) => {
          if (BOOTSTRAP_PEER_IDS.includes(p.toString())) {
            return null
          }

          return (
            <div key={p.toString()} className="hover:bg-default-100 flex items-center py-1 px-3">
              <PeerWrapper peer={p} self={false} withName={true} withUnread={true} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
