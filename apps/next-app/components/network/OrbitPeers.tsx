'use client'

import type { PeerPresence } from '@/hooks/usePeerPresence'

import { useEffect, useMemo, useState } from 'react'
import { Tooltip } from '@heroui/react'
import { Bot, Radio, Video } from 'lucide-react'
import { motion } from 'framer-motion'
import Blockies from 'react-18-blockies'

interface OrbitPeersProps {
  peers: PeerPresence[]
  countOverrides?: { peers?: number; rooms?: number }
}

const RINGS = [18, 28, 38, 48]
const MOBILE_NODE_LIMIT = 10
const DESKTOP_NODE_LIMIT = 18

const hashString = (input: string) => {
  let hash = 0

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }

  return hash >>> 0
}

const formatLastSeen = (lastSeenAt: number, status: PeerPresence['status']) => {
  if (status === 'online') {
    return 'Online now'
  }

  const deltaMs = Date.now() - lastSeenAt
  const minutes = Math.max(1, Math.floor(deltaMs / 60000))

  if (minutes < 60) {
    return `Seen ${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `Seen ${hours}h ago`
  }
  const days = Math.floor(hours / 24)

  return `Seen ${days}d ago`
}

export function OrbitPeers({ peers, countOverrides }: OrbitPeersProps) {
  const [isMobile, setIsMobile] = useState(false)
  const isEmpty = peers.length === 0

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(media.matches)

    update()
    media.addEventListener('change', update)

    return () => media.removeEventListener('change', update)
  }, [])

  const { visiblePeers, overflowCount } = useMemo(() => {
    const cap = isMobile ? MOBILE_NODE_LIMIT : DESKTOP_NODE_LIMIT
    const sorted = [...peers].sort((a, b) => a.peerId.localeCompare(b.peerId))

    return {
      visiblePeers: sorted.slice(0, cap),
      overflowCount: Math.max(0, sorted.length - cap),
    }
  }, [isMobile, peers])

  const counts = useMemo(() => {
    const livePeers = peers.filter((peer) => peer.status === 'online').length
    const roomsOnline = peers.reduce((acc, peer) => {
      if (peer.rooms?.hasAi || peer.rooms?.hasCall || peer.rooms?.hasStream) {
        return acc + 1
      }

      return acc
    }, 0)

    return {
      livePeers: countOverrides?.peers ?? livePeers,
      roomsOnline: countOverrides?.rooms ?? roomsOnline,
    }
  }, [countOverrides, peers])

  return (
    <div className="relative w-full max-w-[520px] aspect-square mx-auto">
      <div className="absolute inset-0 rounded-[36px] bg-white/5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.7)] backdrop-blur-md border border-white/10" />

      <motion.div
        animate={{ rotate: 360 }}
        className="absolute inset-0"
        transition={{ duration: 160, repeat: Infinity, ease: 'linear' }}
      >
        {RINGS.map((radius, index) => (
          <motion.div
            key={`ring-${radius}`}
            animate={{ rotate: index % 2 === 0 ? 360 : -360 }}
            className="absolute left-1/2 top-1/2 rounded-full border border-white/10"
            style={{
              width: `${radius * 2}%`,
              height: `${radius * 2}%`,
              transform: `translate(-50%, -50%)`,
            }}
            transition={{ duration: 120 + index * 30, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </motion.div>

      <motion.div
        animate={{ rotate: -360 }}
        className="absolute inset-0"
        transition={{ duration: 220, repeat: Infinity, ease: 'linear' }}
      >
        {visiblePeers.map((peer) => {
          const hash = hashString(peer.peerId)
          const ringIndex = hash % RINGS.length
          const angle = ((hash % 360) / 360) * Math.PI * 2
          const radius = RINGS[ringIndex]
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          const floatDistance = 2 + (hash % 4)
          const floatDelay = (hash % 10) / 10
          const statusLabel = formatLastSeen(peer.lastSeenAt, peer.status)

          return (
            <motion.div
              key={peer.peerId}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute"
              initial={{ opacity: 0, scale: 0.85 }}
              style={{ left: `calc(50% + ${x}%)`, top: `calc(50% + ${y}%)` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <motion.div
                animate={{ x: [0, floatDistance, 0], y: [0, -floatDistance, 0] }}
                transition={{
                  duration: 7 + (hash % 6),
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: floatDelay,
                }}
              >
                <Tooltip
                  content={
                    <div className="text-xs">
                      <div className="font-semibold uppercase tracking-wide">{peer.displayName}</div>
                      <div className="text-default-400">{statusLabel}</div>
                    </div>
                  }
                  placement="top"
                  radius="sm"
                >
                  <button
                    aria-label={`${peer.displayName}, ${statusLabel}`}
                    className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                    type="button"
                  >
                    <Blockies className="h-10 w-10 rounded-full" scale={3} seed={peer.avatarSeed} size={10} />
                    {peer.rooms?.hasAi && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-white shadow">
                        <Bot className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {peer.rooms?.hasStream && (
                      <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow">
                        <Radio className="h-2.5 w-2.5" />
                      </span>
                    )}
                    {peer.rooms?.hasCall && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white shadow">
                        <Video className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                </Tooltip>
              </motion.div>
            </motion.div>
          )
        })}

        {overflowCount > 0 && (
          <div className="absolute left-1/2 top-1/2 translate-x-[120%] -translate-y-[120%]">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/15 text-xs font-semibold text-white shadow">
              +{overflowCount}
            </div>
          </div>
        )}
      </motion.div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-center backdrop-blur-md">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-default-300">
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
            Live
          </div>
          <div className="mt-2 text-3xl font-semibold text-white">{counts.livePeers}</div>
          <div className="text-xs text-default-300">Live peers</div>
          <div className="mt-3 text-lg font-semibold text-white">{counts.roomsOnline}</div>
          <div className="text-[11px] uppercase tracking-[0.25em] text-default-400">Rooms online</div>
          {isEmpty && <div className="mt-2 text-xs text-white/70">Waiting for peers to appear</div>}
        </div>
      </div>

      <div className="absolute -bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] text-default-200">
        <span className="flex items-center gap-1">
          <Bot className="h-3 w-3 text-purple-300" />
          AI room
        </span>
        <span className="flex items-center gap-1">
          <Radio className="h-3 w-3 text-red-300" />
          Stream
        </span>
        <span className="flex items-center gap-1">
          <Video className="h-3 w-3 text-green-300" />
          Call
        </span>
      </div>
    </div>
  )
}
