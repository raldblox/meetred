import { useEffect, useMemo, useState } from 'react'
import { multiaddr } from '@multiformats/multiaddr'

import { BOOTSTRAP_PEER_IDS, SPECIAL_PEERS } from '@/config/constants'

const LOCAL_RELAY_ENV = process.env.NEXT_PUBLIC_LOCAL_RELAY_ADDRS ?? ''
const ARCHIVAL_METRICS_URL = process.env.NEXT_PUBLIC_ARN_METRICS_URL ?? ''
const METRICS_URL = process.env.NEXT_PUBLIC_METRICS_URL ?? ''

const cleanEntry = (value: string) => {
  const trimmed = value.trim()

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

const tryParsePeerId = (addr: string) => {
  const cleaned = cleanEntry(addr)

  if (!cleaned) {
    return null
  }

  if (!cleaned.includes('/')) {
    return cleaned
  }

  try {
    const parsed = multiaddr(cleaned).getPeerId()

    if (parsed) {
      return parsed
    }
  } catch {
    // fall through to regex
  }

  const match = cleaned.match(/\/p2p\/([^/]+)/)

  return match ? match[1] : null
}

export function useSpecialPeers() {
  const basePeers = useMemo(() => {
    const next: Record<string, string> = {}

    Object.entries(SPECIAL_PEERS ?? {}).forEach(([peerId, kind]) => {
      if (kind) {
        next[peerId] = kind
      }
    })

    BOOTSTRAP_PEER_IDS.forEach((peerId) => {
      if (!next[peerId]) {
        next[peerId] = 'bootstrap'
      }
    })

    const parsedRelayIds: string[] = []

    if (LOCAL_RELAY_ENV) {
      LOCAL_RELAY_ENV.split(/[;,]/)
        .map(cleanEntry)
        .filter((entry) => entry.length > 0)
        .forEach((entry) => {
          const peerId = tryParsePeerId(entry)

          if (peerId) {
            parsedRelayIds.push(peerId)
            if (!next[peerId]) {
              next[peerId] = 'relay'
            }
          }
        })
    }

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.info('[special-peers]', {
        localRelayEnv: LOCAL_RELAY_ENV,
        parsedRelayIds,
        resolved: next,
      })
    }

    return next
  }, [])

  const [resolvedPeers, setResolvedPeers] = useState<Record<string, string>>(basePeers)

  useEffect(() => {
    setResolvedPeers(basePeers)
  }, [basePeers])

  useEffect(() => {
    const requests: Array<{ url: string; kind: string }> = []

    if (ARCHIVAL_METRICS_URL) {
      requests.push({ url: ARCHIVAL_METRICS_URL, kind: 'archival' })
    }
    if (METRICS_URL) {
      requests.push({ url: METRICS_URL, kind: 'metrics' })
    }

    if (requests.length === 0) {
      return
    }

    let cancelled = false

    const run = async () => {
      for (const { url, kind } of requests) {
        try {
          const res = await fetch(url)

          if (!res.ok) {
            continue
          }
          const data = (await res.json()) as { peerId?: string }

          if (!data?.peerId) {
            continue
          }
          if (cancelled) {
            return
          }
          setResolvedPeers((prev) => (prev[data.peerId!] ? prev : { ...prev, [data.peerId!]: kind }))
        } catch {
          // ignore unreachable metrics endpoints
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  return useMemo(() => resolvedPeers, [resolvedPeers])
}
