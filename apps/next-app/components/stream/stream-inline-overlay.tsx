'use client'

import type { KeyboardEvent, ReactNode } from 'react'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { XIcon } from 'lucide-react'

interface StreamInlineOverlayProps {
  open: boolean
  onClose: () => void
  streamId: string
  children: ReactNode
}

export function StreamInlineOverlay({ open, onClose, streamId, children }: StreamInlineOverlayProps) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)

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

  if (!mounted) {
    return null
  }

  const overlayOpacity = closing ? 'opacity-0' : 'opacity-100'
  const panelTransform = closing ? 'scale-95 translate-y-4 opacity-0' : 'scale-100 translate-y-0 opacity-100'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 transition ${
        closing ? 'bg-black/0' : 'bg-black/60'
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
        className={`relative z-10 w-full max-w-3xl transition-all duration-200 ${panelTransform}`}
        style={{ pointerEvents: closing ? 'none' : 'auto' }}
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
          className={`rounded-3xl border border-default-100 bg-default-50/95 p-4 shadow-2xl sm:p-6 ${overlayOpacity}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
