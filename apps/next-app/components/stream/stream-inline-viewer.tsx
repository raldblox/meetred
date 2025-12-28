'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useStreamContext } from '@/context/stream-ctx'

// Inline viewer that reuses the existing stream context so the preview tile and overlay
// can point at the same MediaStream instance. This avoids restarts/blank frames when
// users expand the preview into the larger modal.
export function StreamInlineViewer() {
  const { remoteStream, status, error, resetError } = useStreamContext()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [aspectRatio, setAspectRatio] = useState(16 / 9)

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const updateRatio = () => {
      const { videoWidth, videoHeight } = video

      if (videoWidth > 0 && videoHeight > 0) {
        setAspectRatio(videoWidth / videoHeight)
      }
    }

    if (remoteStream) {
      if (video.srcObject !== remoteStream) {
        video.srcObject = remoteStream
      }

      const playPromise = video.play()

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay rejections; the overlay only opens after a user gesture.
        })
      }

      video.addEventListener('loadedmetadata', updateRatio)
    } else {
      video.srcObject = null
    }

    return () => {
      video.removeEventListener('loadedmetadata', updateRatio)
    }
  }, [remoteStream])

  useEffect(() => {
    if (!remoteStream) {
      return
    }

    const track = remoteStream.getVideoTracks?.()[0]
    const settings = track?.getSettings?.()

    if (settings?.width && settings?.height) {
      setAspectRatio(settings.width / settings.height)
    }
  }, [remoteStream])

  const statusLabel = useMemo(() => {
    if (remoteStream && status === 'live') {
      return 'Live now'
    }
    if (status === 'connecting' || status === 'starting') {
      return 'Connecting to host'
    }
    if (status === 'error') {
      return 'Connection error'
    }

    return 'Waiting for host'
  }, [remoteStream, status])

  const badgeTone =
    remoteStream && status === 'live' ? 'bg-rose-500/90 text-foreground' : 'bg-default-100/80 text-foreground/80'

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-sm bg-black" style={{ aspectRatio }}>
        {remoteStream ? (
          <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain bg-black">
            <track
              default
              kind="captions"
              label="Live stream placeholder captions"
              src="/captions/live-placeholder.vtt"
              srcLang="en"
            />
          </video>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-foreground/70">
            <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/70" />
            {status === 'error' ? 'Unable to load the stream yet.' : 'Waiting for the host to go live.'}
          </div>
        )}
        <span
          className={`absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeTone}`}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-default-800" />
          {statusLabel}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200/80 bg-red-50 px-3 py-2 text-xs text-red-700 text-left shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button className="font-semibold uppercase tracking-wide text-[10px]" onClick={resetError}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
