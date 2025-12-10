import type { ReactNode } from 'react'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import type { Libp2pType } from '@/context/libp2p-ctx'
import { startLibp2p, type StartLibp2pOptions } from '@/lib/libp2p'
import { forComponent } from '@/lib/logger'
import {
  importExtensionPrivateKey,
  loadOrCreateExtensionPrivateKey,
} from '@extension/lib/extension-identity'

interface Libp2pContextValue {
  libp2p?: Libp2pType
  status: 'booting' | 'ready' | 'error'
  error?: string | null
  restart: (options?: StartLibp2pOptions) => Promise<void>
  rotateIdentity: () => Promise<void>
  rotatingIdentity: boolean
  importIdentity: (encodedKey: string) => Promise<void>
}

const Libp2pContext = createContext<Libp2pContextValue>({
  status: 'booting',
  restart: async () => {},
  rotateIdentity: async () => {},
  rotatingIdentity: false,
  importIdentity: async () => {},
})

const log = forComponent('extension-libp2p')

export function ExtensionLibp2pProvider({ children }: { children: ReactNode }) {
  const [libp2p, setLibp2p] = useState<Libp2pType | undefined>(undefined)
  const [status, setStatus] = useState<'booting' | 'ready' | 'error'>('booting')
  const [error, setError] = useState<string | null>(null)
  const [rotatingIdentity, setRotatingIdentity] = useState(false)
  const hasInitialized = useRef(false)

  const boot = useCallback(
    async (options?: StartLibp2pOptions) => {
      setStatus('booting')
      try {
        const node = (await startLibp2p({
          ...options,
          privateKey: await loadOrCreateExtensionPrivateKey({
            forceNew: options?.forceNewIdentity,
          }),
        })) as Libp2pType

        // @ts-ignore helpful for debugging inside DevTools
        window.libp2p = node

        setLibp2p(node)
        setStatus('ready')
        setError(null)
      } catch (err: any) {
        log.error('failed to start libp2p %o', err)
        setError(err?.message ?? 'Failed to start libp2p')
        setStatus('error')
        throw err
      }
    },
    [],
  )

  const stopNode = useCallback(async () => {
    if (!libp2p) {
      return
    }

    try {
      await libp2p.stop()
    } catch (err) {
      log.error('failed to stop libp2p %o', err)
    }
  }, [libp2p])

  const restart = useCallback(
    async (options?: StartLibp2pOptions) => {
      await stopNode()
      setLibp2p(undefined)
      await boot(options)
    },
    [boot, stopNode],
  )

  const rotateIdentity = useCallback(async () => {
    if (rotatingIdentity) {
      return
    }

    setRotatingIdentity(true)

    try {
      await restart({ forceNewIdentity: true })
    } finally {
      setRotatingIdentity(false)
    }
  }, [restart, rotatingIdentity])

  const importIdentity = useCallback(
    async (encodedKey: string) => {
      if (rotatingIdentity) {
        return
      }

      setRotatingIdentity(true)

      try {
        await importExtensionPrivateKey(encodedKey)
        await restart()
      } finally {
        setRotatingIdentity(false)
      }
    },
    [restart, rotatingIdentity],
  )

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    boot().catch((err) => log.error('initial libp2p boot failed %o', err))
  }, [boot])

  return (
    <Libp2pContext.Provider value={{ libp2p, status, error, restart, rotateIdentity, rotatingIdentity, importIdentity }}>
      {children}
    </Libp2pContext.Provider>
  )
}

export function useExtensionLibp2p() {
  return useContext(Libp2pContext)
}
