'use client'

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { XIcon } from 'lucide-react'

import { useStreamContext } from '@/context/stream-ctx'

interface StreamInlineOverlayProps {
  open: boolean
  onClose: () => void
  streamId: string
  children: ReactNode
}

export function StreamInlineOverlay({ open, onClose, streamId, children }: StreamInlineOverlayProps) {
  const { remoteStream } = useStreamContext()
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)
  const videoTrack = useMemo(() => remoteStream?.getVideoTracks?.()[0] ?? null, [remoteStream])
  const contentRef = useRef<HTMLDivElement | null>(null)

  const handleBackdropKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined

    if (open) {
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      timeout = setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, 200)
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [open, mounted])

  useEffect(() => {
    if (!videoTrack) {
      setAspectRatio(16 / 9)

      return
    }

    const applyTrackDimensions = () => {
      const settings = videoTrack.getSettings?.()
      const width = settings?.width
      const height = settings?.height

      if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
        setAspectRatio(width / height)
      }
    }

    applyTrackDimensions()

    const handleResize = () => {
      applyTrackDimensions()
    }

    const handleUnmute = () => {
      applyTrackDimensions()
    }

    if (typeof videoTrack.addEventListener === 'function') {
      videoTrack.addEventListener('resize', handleResize)
      videoTrack.addEventListener('unmute', handleUnmute)

      return () => {
        videoTrack.removeEventListener('resize', handleResize)
        videoTrack.removeEventListener('unmute', handleUnmute)
      }
    }

    const poll = window.setInterval(applyTrackDimensions, 500)

    return () => {
      window.clearInterval(poll)
    }
  }, [videoTrack])

  useEffect(() => {
    const element = contentRef.current

    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      const { width, height } = entry.contentRect

      if (width > 0 && height > 0) {
        setAspectRatio(width / height)
      }
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [mounted])

  if (!mounted) {
    return null
  }

  const overlayOpacity = closing ? 'opacity-0' : 'opacity-100'
  const panelTransform = closing ? 'scale-95 translate-y-4 opacity-0' : 'scale-100 translate-y-0 opacity-100'
  const isLandscape = aspectRatio <= 1
  const containerClasses = isLandscape ? 'w-full max-w-md' : 'w-full sm:w-auto max-h-[60vh] max-w-[55vw]'
  const containerStyle: CSSProperties = {
    pointerEvents: closing ? 'none' : 'auto',
    ...(isLandscape ? {} : { maxHeight: '60vh' }),
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 transition ${
        closing ? 'bg-black/0' : 'bg-background/50'
      }`}
    >
      <div
        aria-label="Close stream preview"
        className="absolute inset-0"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
      />
      <div
        className={`relative z-10 transition-all duration-200 ${panelTransform} ${containerClasses}`}
        style={containerStyle}
      >
        <div className="absolute -top-10 right-0 flex items-center gap-2 text-sm">
          <Link
            className="rounded-full border border-default-200 px-3 py-1 font-semibold text-default-700 hover:bg-default-100"
            href={`/stream/${streamId}`}
            onClick={onClose}
          >
            Open full stream
          </Link>
          <button
            aria-label="Close stream preview"
            className="rounded-full border border-default-200 p-2 text-default-500 hover:bg-default-200"
            onClick={onClose}
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div
          ref={contentRef}
          className={`rounded-3xl border border-default-100 bg-default-50/95 p-2 shadow-2xl ${overlayOpacity}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
