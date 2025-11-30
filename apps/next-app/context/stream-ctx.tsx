'use client'

import { createContext, useContext, useState } from 'react'

import { useLibp2pContext } from '@/context/libp2p-ctx'

type StreamRole = 'host' | 'viewer' | null

interface StreamContextValue {
  streamId?: string | null
  hostPeerId?: string | null
}

const StreamContext = createContext<StreamContextValue>({})

export function StreamProvider({ children }: { children: React.ReactNode }) {
  const { libp2p } = useLibp2pContext()
  const [streamingEnabled, setStreamingEnabled] = useState(false)
  const [streamId, setStreamId] = useState<string | null>(null)

  const value = {}

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
}

export const useStreamContext = () => useContext(StreamContext)
