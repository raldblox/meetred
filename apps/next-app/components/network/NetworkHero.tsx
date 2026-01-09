'use client'

import type { PeerPresence } from '@/hooks/usePeerPresence'

import NextLink from 'next/link'
import { Button } from '@heroui/react'

import { InviteButton } from '@/components/chat/invite-modal'
import { OrbitPeers } from '@/components/network/OrbitPeers'

interface NetworkHeroProps {
  peers: PeerPresence[]
  countOverrides?: { peers?: number; rooms?: number }
  ogMode?: boolean
  showEmptyState?: boolean
}

export function NetworkHero({ peers, countOverrides, ogMode = false, showEmptyState = false }: NetworkHeroProps) {
  return (
    <section className={`grid lg:grid-cols-6 w-full gap-12 h-full`}>
      <div className="relative w-full md:col-start-2 md:col-span-3 z-10 flex h-full">
        <div className="flex flex-col justify-center gap-6 text-white">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[11px] uppercase tracking-[0.3em]">
            Meetred Network
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Live rooms. Live peers.
          </h1>
          <p className="max-w-lg text-base text-white/80 sm:text-lg">
            Open Meetred and you are live in the Public room. Start an AI room, Stream, or Call in one click.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              aria-label="Open public room"
              as={NextLink}
              className="h-11 px-6 text-sm font-semibold"
              color="primary"
              href="/"
              radius="full"
              variant="solid"
            >
              Open Public room
            </Button>
            <InviteButton
              ariaLabel="Invite a friend"
              className="h-11 px-6 text-sm font-semibold text-white/90 border border-white/30 bg-white/5 hover:bg-white/15"
              label="Invite a friend"
              radius="full"
              size="md"
              variant="bordered"
            />
          </div>
          {showEmptyState && (
            <div className="mt-4 w-fit rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80">
              No peers yet. You are already live in the Public room.
            </div>
          )}
        </div>

        <div className="flex items-center justify-center">
          <OrbitPeers countOverrides={countOverrides} peers={peers} />
        </div>
      </div>
    </section>
  )
}
