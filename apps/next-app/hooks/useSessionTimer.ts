'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export function useSessionTimer() {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      if (startRef.current) {
        setElapsedMs(Date.now() - startRef.current)
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
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

  return { formatted, elapsedMs }
}
