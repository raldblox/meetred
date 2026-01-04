'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Manual session timer. Start/stop/reset via API so rooms can gate when billing begins.
 */
export function useSessionTimer() {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const startRef = useRef<number | null>(null)
  const accruedRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const start = () => {
    if (isRunning) return
    startRef.current = Date.now()
    setIsRunning(true)
    timerRef.current = setInterval(() => {
      if (startRef.current) {
        setElapsedMs(accruedRef.current + (Date.now() - startRef.current))
      }
    }, 1000)
  }

  const stop = () => {
    if (!isRunning) return
    if (startRef.current) {
      accruedRef.current += Date.now() - startRef.current
    }
    startRef.current = null
    clearTimer()
    setIsRunning(false)
    setElapsedMs(accruedRef.current)
  }

  const reset = () => {
    accruedRef.current = 0
    startRef.current = isRunning ? Date.now() : null
    setElapsedMs(0)
  }

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [])

  const formatted = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const pad = (value: number) => value.toString().padStart(2, '0')

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }, [elapsedMs])

  return { formatted, elapsedMs, isRunning, start, stop, reset }
}
