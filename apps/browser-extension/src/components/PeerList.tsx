import { useState } from 'react'
import { Copy } from 'lucide-react'
import clsx from 'clsx'

import type { PeerPresenceInfo } from '../hooks/usePeerPresence'

interface PeerListProps {
  peers: PeerPresenceInfo[]
}

const formatRelativeTime = (timestamp?: number) => {
  if (!timestamp) {
    return 'Just now'
  }

  const diff = Date.now() - timestamp

  if (diff < 60_000) {
    return 'seconds ago'
  }
  if (diff < 3_600_000) {
    const minutes = Math.round(diff / 60_000)
    return `${minutes} min ago`
  }

  const hours = Math.round(diff / 3_600_000)

  return `${hours}h ago`
}

export function PeerList({ peers }: PeerListProps) {
  const [copiedPeer, setCopiedPeer] = useState<string | null>(null)

  const handleCopy = async (peerId: string) => {
    try {
      await navigator.clipboard.writeText(peerId)
      setCopiedPeer(peerId)
      setTimeout(() => setCopiedPeer(null), 2000)
    } catch {
      // ignored
    }
  }

  if (peers.length === 0) {
    return <p className="empty-state">No peers connected yet. Keep the web app open to discover more.</p>
  }

  return (
    <ul className="peer-list">
      {peers.map((peer) => {
        const statusClass = peer.connected
          ? 'status-pill--live'
          : peer.viaPubsub
          ? 'status-pill--warm'
          : 'status-pill--idle'

        const statusLabel = peer.connected ? 'Connected' : peer.viaPubsub ? 'Discovered' : 'Seen'

        return (
          <li key={peer.peerId} className="peer-row">
            <div className="peer-row__main">
              <span className="peer-row__id">{peer.peerId.slice(-10)}</span>
              <span className={clsx('status-pill', statusClass)}>{statusLabel}</span>
            </div>
            <div className="peer-row__meta">
              <span>{peer.connected ? 'Active now' : `Last signal: ${formatRelativeTime(peer.lastSeenAt)}`}</span>
              {peer.protocols.length > 0 && (
                <span className="peer-row__protocols">{peer.protocols.join(', ')}</span>
              )}
            </div>
            <div className="peer-row__actions">
              <button
                className="button button--ghost button--xs"
                type="button"
                onClick={() => handleCopy(peer.peerId)}
              >
                <Copy size={14} /> {copiedPeer === peer.peerId ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
