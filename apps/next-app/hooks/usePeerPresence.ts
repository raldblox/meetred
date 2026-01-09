'use client'

import type { PeerId } from '@libp2p/interface'
import type { MutableRefObject } from 'react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { BOOTSTRAP_PEER_IDS, CHAT_TOPIC } from '@/config/constants'

export type PeerPresenceStatus = 'online' | 'recent' | 'offline'

export interface PeerPresence {
  peerId: string
  displayName: string
  avatarSeed: string
  status: PeerPresenceStatus
  lastSeenAt: number
  rooms?: { hasCall?: boolean; hasStream?: boolean; hasAi?: boolean }
}

const RECENT_WINDOW_MS = 5 * 60 * 1000
const TICK_INTERVAL_MS = 30 * 1000

const recordLastSeen = (store: MutableRefObject<Map<string, number>>, peerId: string) => {
  store.current.set(peerId, Date.now())
}

export function usePeerPresence(): PeerPresence[] {
  const { libp2p } = useLibp2pContext()
  const [subscribers, setSubscribers] = useState<string[]>([])
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [seenPeers, setSeenPeers] = useState<string[]>([])
  const lastSeenRef = useRef<Map<string, number>>(new Map())
  const [tick, setTick] = useState(0)

  const updateConnections = useCallback(() => {
    const ids = libp2p
      .getConnections()
      .map((conn) => conn.remotePeer.toString())
      .filter((peerId) => peerId !== libp2p.peerId.toString() && !BOOTSTRAP_PEER_IDS.includes(peerId))

    ids.forEach((peerId) => recordLastSeen(lastSeenRef, peerId))
    setConnectedPeers(Array.from(new Set(ids)))
  }, [libp2p])

  useEffect(() => {
    const onSubscriptionChange = () => {
      const peers = libp2p.services.pubsub.getSubscribers(CHAT_TOPIC) as unknown as PeerId[]
      const next = peers.map((peer) => peer.toString())

      next.forEach((peerId) => recordLastSeen(lastSeenRef, peerId))
      setSubscribers(next)
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

      recordLastSeen(lastSeenRef, from)
      setSeenPeers((prev) => (prev.includes(from) ? prev : [...prev, from]))
    }

    libp2p.services.pubsub.addEventListener('message', onMessage)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', onMessage)
    }
  }, [libp2p])

  useEffect(() => {
    updateConnections()

    const onOpen = () => updateConnections()
    const onClose = (evt: CustomEvent) => {
      const peerId = evt.detail?.remotePeer?.toString?.()

      if (peerId) {
        recordLastSeen(lastSeenRef, peerId)
      }

      updateConnections()
    }

    libp2p.addEventListener('connection:open', onOpen)
    libp2p.addEventListener('connection:close', onClose)

    return () => {
      libp2p.removeEventListener('connection:open', onOpen)
      libp2p.removeEventListener('connection:close', onClose)
    }
  }, [libp2p, updateConnections])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTick((prev) => prev + 1)
    }, TICK_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [])

  return useMemo(() => {
    const ids = Array.from(
      new Set([...connectedPeers, ...subscribers.filter((peer) => peer !== ''), ...seenPeers]),
    ).filter((peerId) => peerId !== libp2p.peerId.toString() && !BOOTSTRAP_PEER_IDS.includes(peerId))

    const now = Date.now()

    return ids.map((peerId) => {
      const lastSeenAt = lastSeenRef.current.get(peerId) ?? now
      const status: PeerPresenceStatus = connectedPeers.includes(peerId)
        ? 'online'
        : now - lastSeenAt < RECENT_WINDOW_MS
          ? 'recent'
          : 'offline'

      return {
        peerId,
        displayName: peerId.slice(-7).toUpperCase(),
        avatarSeed: peerId,
        status,
        lastSeenAt,
      }
    })
  }, [connectedPeers, libp2p.peerId, seenPeers, subscribers, tick])
}
