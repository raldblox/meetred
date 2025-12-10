import type { Libp2pType } from '@/context/libp2p-ctx'
import type { PeerId } from '@libp2p/interface'
import { useEffect, useMemo, useState } from 'react'

import { BOOTSTRAP_PEER_IDS, CHAT_TOPIC } from '@/config/constants'

export interface PeerPresenceInfo {
  peerId: string
  connected: boolean
  viaPubsub: boolean
  lastSeenAt?: number
  protocols: string[]
}

interface PresenceSummary {
  peers: PeerPresenceInfo[]
  connectedCount: number
  subscribedCount: number
}

const isBootstrapPeer = (peerId: string) => BOOTSTRAP_PEER_IDS.includes(peerId)

export function usePeerPresence(libp2p?: Libp2pType): PresenceSummary {
  const [connections, setConnections] = useState<Record<string, string[]>>({})
  const [subscriberIds, setSubscriberIds] = useState<string[]>([])
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!libp2p) {
      return
    }

    const updateConnections = () => {
      const next: Record<string, string[]> = {}

      libp2p.getConnections().forEach((conn) => {
        const id = conn.remotePeer.toString()

        if (id === libp2p.peerId.toString() || isBootstrapPeer(id)) {
          return
        }

        next[id] = Array.from(new Set(conn.remoteAddr?.protoNames?.() ?? []))
      })

      setConnections(next)
    }

    updateConnections()
    libp2p.addEventListener('connection:open', updateConnections)
    libp2p.addEventListener('connection:close', updateConnections)

    return () => {
      libp2p.removeEventListener('connection:open', updateConnections)
      libp2p.removeEventListener('connection:close', updateConnections)
    }
  }, [libp2p])

  useEffect(() => {
    if (!libp2p) {
      return
    }

    const handleSubscriptionChange = () => {
      const subscribers = (libp2p.services.pubsub.getSubscribers(CHAT_TOPIC) ?? []) as unknown as PeerId[]
      const ids = subscribers
        .map((peer) => peer.toString())
        .filter((id) => id !== libp2p.peerId.toString() && !isBootstrapPeer(id))

      setSubscriberIds(Array.from(new Set(ids)))
    }

    handleSubscriptionChange()
    libp2p.services.pubsub.addEventListener('subscription-change', handleSubscriptionChange)

    return () => {
      libp2p.services.pubsub.removeEventListener('subscription-change', handleSubscriptionChange)
    }
  }, [libp2p])

  useEffect(() => {
    if (!libp2p) {
      return
    }

    const handleMessage = (evt: CustomEvent) => {
      const from = (evt.detail?.from as PeerId | undefined)?.toString()

      if (!from || from === libp2p.peerId.toString() || isBootstrapPeer(from)) {
        return
      }

      setLastSeen((prev) => ({
        ...prev,
        [from]: Date.now(),
      }))
    }

    libp2p.services.pubsub.addEventListener('message', handleMessage)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', handleMessage)
    }
  }, [libp2p])

  return useMemo(() => {
    if (!libp2p) {
      return { peers: [], connectedCount: 0, subscribedCount: 0 }
    }

    const ids = new Set<string>([...Object.keys(connections), ...subscriberIds, ...Object.keys(lastSeen)])
    ids.delete(libp2p.peerId.toString())
    BOOTSTRAP_PEER_IDS.forEach((peerId) => ids.delete(peerId))

    const peers: PeerPresenceInfo[] = Array.from(ids).map((peerId) => ({
      peerId,
      connected: Boolean(connections[peerId]),
      viaPubsub: subscriberIds.includes(peerId),
      lastSeenAt: lastSeen[peerId],
      protocols: connections[peerId] ?? [],
    }))

    peers.sort((a, b) => {
      if (a.connected && !b.connected) return -1
      if (!a.connected && b.connected) return 1

      const aSeen = a.lastSeenAt ?? 0
      const bSeen = b.lastSeenAt ?? 0

      if (aSeen !== bSeen) {
        return bSeen - aSeen
      }

      return a.peerId.localeCompare(b.peerId)
    })

    return {
      peers,
      connectedCount: Object.keys(connections).length,
      subscribedCount: subscriberIds.length,
    }
  }, [connections, lastSeen, libp2p, subscriberIds])
}
