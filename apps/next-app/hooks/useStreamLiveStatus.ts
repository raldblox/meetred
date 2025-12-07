'use client'

import { useEffect, useRef, useState } from 'react'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CHAT_TOPIC, STREAM_SIGNAL_WRAPPER } from '@/lib/constants'

type StreamLiveState = 'checking' | 'live' | 'offline'

export const useStreamLiveStatus = (streamId?: string, enabled: boolean = true) => {
  const { libp2p } = useLibp2pContext()
  const [state, setState] = useState<StreamLiveState>('checking')
  const helloSentRef = useRef(false)
  const timeoutRef = useRef<number>()

  useEffect(() => {
    setState('checking')
    helloSentRef.current = false

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
  }, [streamId, enabled])

  useEffect(() => {
    if (!libp2p || !streamId || !enabled) {
      return
    }

    const handleSignal = (event: CustomEvent<any>) => {
      if (event.detail.topic !== CHAT_TOPIC || event.detail.type !== 'signed') {
        return
      }

      let envelope: any

      try {
        envelope = JSON.parse(uint8ArrayToString(event.detail.data))
      } catch {
        return
      }

      if (envelope?.type !== STREAM_SIGNAL_WRAPPER || envelope?.payload?.streamId !== streamId) {
        return
      }

      if (envelope.payload.action === 'host-ready') {
        const live = envelope.payload?.payload?.live ?? true

        setState(live ? 'live' : 'offline')
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = undefined
        }
      }
    }

    libp2p.services.pubsub.addEventListener('message', handleSignal)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', handleSignal)
    }
  }, [enabled, libp2p, streamId])

  useEffect(() => {
    if (!libp2p || !streamId || !enabled || helloSentRef.current) {
      return
    }

    helloSentRef.current = true

    const sendHello = async () => {
      try {
        const envelope = {
          type: STREAM_SIGNAL_WRAPPER,
          payload: {
            streamId,
            action: 'viewer-hello',
            from: libp2p.peerId?.toString(),
          },
        }

        await libp2p.services.pubsub.publish(CHAT_TOPIC, uint8ArrayFromString(JSON.stringify(envelope)))
      } catch {
        setState('offline')
      }
    }

    timeoutRef.current = window.setTimeout(() => {
      setState((prev) => (prev === 'checking' ? 'offline' : prev))
    }, 5000)

    sendHello()

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = undefined
      }
    }
  }, [enabled, libp2p, streamId])

  return {
    state,
    isLive: state === 'live',
  }
}
