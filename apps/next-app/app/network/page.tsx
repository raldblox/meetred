'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

import { Navbar } from '@/components/ui/navbar'
import { NetworkHero } from '@/components/network/NetworkHero'
import { usePeerPresence, type PeerPresence } from '@/hooks/usePeerPresence'
import Grid from '@/components/grid'

const hashString = (input: string) => {
  let hash = 0

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }

  return hash >>> 0
}

const buildDemoPeers = (count: number): PeerPresence[] =>
  Array.from({ length: count }, (_, index) => {
    const peerId = `demo-peer-${index + 1}`
    const hash = hashString(peerId)
    const displayName = hash.toString(36).toUpperCase().slice(0, 7).padStart(7, '0')

    return {
      peerId,
      displayName,
      avatarSeed: peerId,
      status: hash % 4 === 0 ? 'recent' : 'online',
      lastSeenAt: Date.now() - (hash % 180) * 1000,
      rooms: {
        hasAi: hash % 2 === 0,
        hasStream: hash % 3 === 0,
        hasCall: hash % 5 === 0,
      },
    }
  })

export default function NetworkPage() {
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') || '').toLowerCase()
  const ogMode = mode === 'og'
  const demoMode = mode === 'demo'

  const livePeers = usePeerPresence()
  const shouldSeedDemo = livePeers.length === 0 && (demoMode || ogMode)

  const peers = useMemo(() => {
    if (shouldSeedDemo) {
      return buildDemoPeers(12)
    }

    return livePeers
  }, [livePeers, shouldSeedDemo])

  const countOverrides = useMemo(() => {
    if (ogMode && livePeers.length === 0) {
      return { peers: 12, rooms: 4 }
    }

    return undefined
  }, [livePeers.length, ogMode])

  return (
    <Grid
      main={
        <NetworkHero
          countOverrides={countOverrides}
          ogMode={ogMode}
          peers={peers}
          showEmptyState={livePeers.length === 0 && !shouldSeedDemo}
        />
      }
    />
  )
}
