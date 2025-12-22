'use client'

import type { Libp2p, PubSub } from '@libp2p/interface'
import type { Identify } from '@libp2p/identify'
import type { DirectMessage } from '@/lib/direct-message'
import type { DelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import type { GossipsubEvents } from '@chainsafe/libp2p-gossipsub'
import type { Ping } from '@libp2p/ping'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'

import { startLibp2p, type StartLibp2pOptions } from '../lib/libp2p'

import { ChatProvider } from './chat-ctx'

import { forComponent } from '@/lib/logger'
import { importPrivateKey } from '@/lib/identity'
import { Booting } from '@/components/ui/booting'
import {
  DEFAULT_BOOT_STEPS,
  getBootStatusCopy,
  type BootPhase,
  type BootPhaseState,
  type BootStepSnapshot,
  type BootStatusUpdate,
} from '@/lib/boot-status'

export type Libp2pType = Libp2p<{
  pubsub: PubSub<GossipsubEvents>
  identify: Identify
  directMessage: DirectMessage
  delegatedRouting: DelegatedRoutingV1HttpApiClient
  ping: Ping
}>

interface Libp2pContextValue {
  libp2p: Libp2pType
  createNewIdentity: () => Promise<void>
  rotatingIdentity: boolean
  importIdentity: (encodedKey: string) => Promise<void>
}

export const Libp2pContext = createContext<Libp2pContextValue>({
  // @ts-ignore intentional - components are only rendered after libp2p is ready
  libp2p: undefined,
  createNewIdentity: async () => {},
  rotatingIdentity: false,
  importIdentity: async () => {},
})

interface WrapperProps {
  children?: ReactNode
}

const log = forComponent('libp2p-context')

const buildBootSteps = (): BootStepSnapshot[] =>
  DEFAULT_BOOT_STEPS.map((step) => ({
    ...step,
    state: 'pending',
    message: undefined,
  }))

export function Libp2pProvider({ children }: WrapperProps) {
  const [libp2p, setLibp2p] = useState<Libp2pType | undefined>(undefined)
  const [error, setError] = useState('')
  const [rotatingIdentity, setRotatingIdentity] = useState(false)
  const [bootSteps, setBootSteps] = useState<BootStepSnapshot[]>(() => buildBootSteps())
  const [peerDiscoveryComplete, setPeerDiscoveryComplete] = useState(false)
  const [bootLogs, setBootLogs] = useState<
    { id: string; text: string; createdAt: number; phase: BootPhase; state: BootPhaseState }[]
  >([])
  const hasInitialized = useRef(false)
  const bootSequenceRef = useRef(0)
  const bootLogIdRef = useRef(0)
  const overlayDismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearOverlayDismiss = useCallback(() => {
    if (overlayDismissTimeoutRef.current) {
      clearTimeout(overlayDismissTimeoutRef.current)
      overlayDismissTimeoutRef.current = null
    }
  }, [])

  const requestOverlayDismiss = useCallback(() => {
    clearOverlayDismiss()
    overlayDismissTimeoutRef.current = setTimeout(() => {
      setPeerDiscoveryComplete(true)
      overlayDismissTimeoutRef.current = null
    }, 1_500)
  }, [clearOverlayDismiss])

  const handleBootStatusUpdate = useCallback(
    (update: BootStatusUpdate) => {
      setBootSteps((prev) =>
        prev.map((step) =>
          step.phase === update.phase
            ? { ...step, state: update.state, message: update.message ?? step.message }
            : step,
        ),
      )

      const message = getBootStatusCopy(update.phase, update.state)

      setBootLogs((prev) => {
        if (prev[prev.length - 1]?.text === message) {
          return prev
        }

        const nextLog = {
          id: `${bootSequenceRef.current}-${bootLogIdRef.current++}`,
          text: message,
          createdAt: Date.now(),
          phase: update.phase,
          state: update.state,
        }

        return [...prev, nextLog]
      })

      if (update.phase === 'waiting-for-peers' && update.state === 'complete') {
        requestOverlayDismiss()
      }
    },
    [requestOverlayDismiss],
  )

  const init = useCallback(
    async (options?: StartLibp2pOptions) => {
      const bootId = bootSequenceRef.current + 1

      bootSequenceRef.current = bootId
      setPeerDiscoveryComplete(false)
      clearOverlayDismiss()
      setBootSteps(buildBootSteps())
      setBootLogs([])
      bootLogIdRef.current = 0

      const node = await startLibp2p({
        ...options,
        onStatus: (update) => {
          if (bootSequenceRef.current !== bootId) {
            return
          }

          handleBootStatusUpdate(update)
        },
      })

      // @ts-ignore helpful for local debugging
      window.libp2p = node
      setLibp2p(node as Libp2pType)
      setError('')

      return node
    },
    [clearOverlayDismiss, handleBootStatusUpdate],
  )

  const stopCurrentNode = useCallback(async () => {
    if (!libp2p) {
      return
    }

    try {
      await libp2p.stop()
    } catch (e) {
      log.error('failed to stop libp2p node %o', e)
    }
  }, [libp2p])

  useEffect(() => {
    return () => {
      clearOverlayDismiss()
    }
  }, [clearOverlayDismiss])

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    init().catch((e: any) => {
      log.error('failed to start libp2p %o', e)
      setError(`failed to start libp2p ${e?.message ?? e}`)
    })
  }, [init])

  const performRestart = useCallback(
    async (options?: StartLibp2pOptions) => {
      await stopCurrentNode()
      setLibp2p(undefined)
      await init(options)
    },
    [init, stopCurrentNode],
  )

  const createNewIdentity = useCallback(async () => {
    if (rotatingIdentity) {
      return
    }

    setRotatingIdentity(true)

    try {
      await performRestart({ forceNewIdentity: true })
    } catch (e: any) {
      log.error('failed to rotate identity %o', e)
      setError(`failed to start libp2p ${e?.message ?? e}`)
      throw e
    } finally {
      setRotatingIdentity(false)
    }
  }, [performRestart, rotatingIdentity])

  const importIdentity = useCallback(
    async (encodedKey: string) => {
      if (rotatingIdentity) {
        return
      }

      setRotatingIdentity(true)

      try {
        await importPrivateKey(encodedKey)
        await performRestart()
      } catch (e: any) {
        log.error('failed to import identity %o', e)
        setError(`failed to start libp2p ${e?.message ?? e}`)
        throw e
      } finally {
        setRotatingIdentity(false)
      }
    },
    [performRestart, rotatingIdentity],
  )

  if (!libp2p) {
    return <Booting error={error} logLines={bootLogs} steps={bootSteps} />
  }

  return (
    <Libp2pContext.Provider value={{ libp2p, createNewIdentity, rotatingIdentity, importIdentity }}>
      <AnimatePresence>
        {!peerDiscoveryComplete ? (
          <Booting key="boot-overlay" error={error} logLines={bootLogs} steps={bootSteps} variant="overlay" />
        ) : null}
      </AnimatePresence>
      <ChatProvider>{children}</ChatProvider>
    </Libp2pContext.Provider>
  )
}

export function useLibp2pContext() {
  return useContext(Libp2pContext)
}
