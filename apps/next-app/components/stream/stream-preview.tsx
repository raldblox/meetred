'use client'

import { useEffect, useRef } from 'react'
import Blockies from 'react-18-blockies'
import { Play } from 'lucide-react'

import { useStreamContext } from '@/context/stream-ctx'

interface StreamInvitePreviewProps {
  onClick?: () => void
  title: string
  description: string
  hostPeerId: string
  status: 'live' | 'checking' | 'offline'
  ctaLabel?: string
}

export function StreamInvitePreview({
  onClick,
  title,
  description,
  hostPeerId,
  status,
  ctaLabel = 'Watch Now',
}: StreamInvitePreviewProps) {
  const { remoteStream } = useStreamContext()
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream
      const playPromise = videoRef.current.play()

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Browser may block autoplay until the user interacts; ignore.
        })
      }
    } else if (videoRef.current && !remoteStream) {
      videoRef.current.srcObject = null
    }
  }, [remoteStream])

  const indicatorLabel = status === 'live' ? 'Live now' : status === 'checking' ? 'Checking stream' : 'Not started'
  const indicatorTone =
    status === 'live' ? 'bg-rose-500/90 text-white' : status === 'checking' ? 'bg-primary-200' : 'bg-default-200'
  const indicatorDot = status === 'live' ? 'bg-foreground' : 'bg-warning'

  return (
    <button
      aria-label="Open stream preview"
      className="group relative block w-full overflow-hidden rounded-lg bg-default-100 text-left shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      type="button"
      onClick={onClick}
    >
      <div className="relative aspect-square md:aspect-video w-full min-h-[250px]">
        <div className="absolute inset-0 bg-default-100">
          {remoteStream && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full rounded-lg object-cover transition duration-700 ease-out group-hover:scale-[1.02]"
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-bl from-default-300/10 to-default-400/10" />
        <span
          className={`absolute left-3 top-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${indicatorTone}`}
        >
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${indicatorDot}`} />
          {indicatorLabel}
        </span>
        <div className="absolute top-4 right-4">
          <Blockies className="h-5 w-5 rounded-sm" scale={3} seed={hostPeerId} size={10} />
        </div>
        <div className="absolute inset-x-4 bottom-6 flex flex-col gap-4 drop-shadow-xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/50">Stream invite</p>
            <p className="text-lg uppercase text-left font-semibold">{title}</p>
          </div>

          <p className="text-sm text-left text-foreground/50">{description}</p>

          <div className="pt-2">
            <span className="inline-flex hover:invert gap-2 bg-foreground text-background items-center justify-center rounded-full px-3 py-2 text-sm font-semibold shadow-lg transition">
              <Play size={14} />
              {ctaLabel}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
