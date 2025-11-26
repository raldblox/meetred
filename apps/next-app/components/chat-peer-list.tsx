'use client'

import type { PeerId } from '@libp2p/interface'

import React, { useEffect, useState } from 'react'

import { PeerWrapper } from './peer'

import { useLibp2pContext } from '@/context/ctx'
import { CHAT_TOPIC } from '@/lib/constants'

interface ChatPeerListProps {
  hideHeader?: boolean
}

export function ChatPeerList({ hideHeader = false }: ChatPeerListProps) {
  const { libp2p } = useLibp2pContext()
  const [subscribers, setSubscribers] = useState<PeerId[]>([])

  useEffect(() => {
    const onSubscriptionChange = () => {
      // libp2p currently exports PeerId types from different packages, so narrow via unknown first
      const subscribers = libp2p.services.pubsub.getSubscribers(CHAT_TOPIC) as unknown as PeerId[]

      setSubscribers(subscribers)
    }

    onSubscriptionChange()
    libp2p.services.pubsub.addEventListener('subscription-change', onSubscriptionChange)

    return () => {
      libp2p.services.pubsub.removeEventListener('subscription-change', onSubscriptionChange)
    }
  }, [libp2p, setSubscribers])

  return (
    <div className="2xl:border-r bg-default-100 border-default-100 lg:col-span-1 h-full">
      {!hideHeader && (
        <h2 className="text-sm font-semibold py-2 px-3 border-b border-default-300 text-default-800">Peers</h2>
      )}
      <div className="overflow-auto h-full">
        <div className="py-2 px-3 focus:outline-none">
          {<PeerWrapper self peer={libp2p.peerId} withName={true} withUnread={false} />}
        </div>
        {subscribers.map((p) => (
          <div key={p.toString()} className="py-2 px-3 focus:outline-none">
            <PeerWrapper peer={p} self={false} withName={true} withUnread={true} />
          </div>
        ))}
      </div>
    </div>
  )
}
