'use client'

import { useEffect, useRef } from 'react'

import { useStreamContext } from '@/context/stream-ctx'

interface StreamInvitePreviewProps {
  onClick?: () => void
}

export function StreamInvitePreview({ onClick }: StreamInvitePreviewProps) {
  const { remoteStream, status } = useStreamContext()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream
    } else if (videoRef.current && !remoteStream) {
      videoRef.current.srcObject = null
    }
  }, [remoteStream])

  const isLive = status === 'live' && Boolean(remoteStream)

  return (
    <button
      className="group block w-full rounded-2xl border border-default-100 bg-default-50/80 p-2 text-left shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
      type="button"
      onClick={onClick}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-default-50">
        {isLive ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.01]"
            />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Live now
            </span>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-white/70">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
            Connecting to stream…
          </div>
        )}
      </div>
    </button>
  )
}
