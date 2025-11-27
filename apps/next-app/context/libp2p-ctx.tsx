'use client'

import type { Libp2p } from '@libp2p/interface'
import type { Identify } from '@libp2p/identify'
import type { DirectMessage } from '@/lib/direct-message'
import type { DelegatedRoutingV1HttpApiClient } from '@helia/delegated-routing-v1-http-api-client'
import type { GossipsubEvents } from '@chainsafe/libp2p-gossipsub'
import type { Ping } from '@libp2p/ping'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react'
import { PubSub } from '@libp2p/interface'

import { startLibp2p, type StartLibp2pOptions } from '../lib/libp2p'

import { ChatProvider } from './chat-ctx'

import { Booting } from '@/components/booting'
import { forComponent } from '@/lib/logger'
import { importPrivateKey } from '@/lib/identity'

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

export function Libp2pProvider({ children }: WrapperProps) {
  const [libp2p, setLibp2p] = useState<Libp2pType | undefined>(undefined)
  const [error, setError] = useState('')
  const [rotatingIdentity, setRotatingIdentity] = useState(false)
  const hasInitialized = useRef(false)

  const init = useCallback(async (options?: StartLibp2pOptions) => {
    const node = await startLibp2p(options)

    // @ts-ignore helpful for local debugging
    window.libp2p = node
    setLibp2p(node as Libp2pType)
    setError('')

    return node
  }, [])

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
    return <Booting error={error} />
  }

  return (
    <Libp2pContext.Provider value={{ libp2p, createNewIdentity, rotatingIdentity, importIdentity }}>
      <ChatProvider>{children}</ChatProvider>
    </Libp2pContext.Provider>
  )
}

export function useLibp2pContext() {
  return useContext(Libp2pContext)
}
