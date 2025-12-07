'use client'

/* eslint-disable jsx-a11y/media-has-caption */

import { useEffect, useRef, useState, useCallback } from 'react'

import { Navbar } from '@/components/ui/navbar'
import { useStreamContext } from '@/context/stream-ctx'

export function StreamRoom({ streamId }: { streamId: string }) {
  const {
    isHost,
    status,
    error,
    localStream,
    remoteStream,
    startHosting,
    stopHosting,
    resetError,
    statusLog,
    roomLogs,
    isScreenSharing,
    toggleScreenShare,
  } = useStreamContext()

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const [remotePlaybackBlocked, setRemotePlaybackBlocked] = useState(false)

  const ensureRemotePlayback = useCallback(() => {
    const video = remoteVideoRef.current

    if (!video) {
      return
    }

    const playPromise = video.play()

    if (playPromise && typeof (playPromise as Promise<void>).then === 'function') {
      playPromise
        .then(() => setRemotePlaybackBlocked(false))
        .catch(() => setRemotePlaybackBlocked(true))
    } else {
      setRemotePlaybackBlocked(false)
    }
  }, [])

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    const video = remoteVideoRef.current

    if (video && remoteStream) {
      video.srcObject = remoteStream
      requestAnimationFrame(() => ensureRemotePlayback())
    } else if (video && !remoteStream) {
      video.srcObject = null
      setRemotePlaybackBlocked(false)
    }
  }, [ensureRemotePlayback, remoteStream])

  const viewerWaitingMessage = 'Waiting for the host to go live.'

  const statusDescription = isHost
    ? status === 'live'
      ? 'You are live now. Viewers will join automatically.'
      : status === 'starting'
        ? 'Allow your browser to use the camera and microphone to go live.'
        : status === 'error'
          ? 'Resolve the error below to restart your stream.'
          : 'You are the host. Start streaming when you are ready.'
    : status === 'live'
      ? 'Enjoy the live stream.'
      : 'Waiting for the host to go live.'

  return (
    <div className="flex flex-col min-h-screen bg-default-50/40 max-w-7xl mx-auto">
      <Navbar />
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-4">
        <div className="rounded-2xl border border-default-100 shadow-sm p-6 flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-medium uppercase text-default-500">Stream</span>
          <h1 className="text-3xl font-semibold">{streamId}</h1>
          <p className="text-sm text-default-500 text-balance">{statusDescription}</p>
          <div className="text-xs text-default-500">
            Logs below are real-time; refresh both tabs to compare host/viewer events.
          </div>
          {isHost && (
            <div className="flex items-center gap-3">
              <button
                className="px-6 py-2 rounded-full text-sm font-semibold bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white transition-colors"
                disabled={status === 'starting'}
                onClick={status === 'live' ? stopHosting : startHosting}
              >
                {status === 'live' ? 'Stop Stream' : 'Start Stream'}
              </button>
              {status === 'live' && (
                <button
                  className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors text-white ${
                    isScreenSharing ? 'bg-red-500 hover:bg-red-600' : 'bg-zinc-700 hover:bg-zinc-800'
                  }`}
                  onClick={toggleScreenShare}
                >
                  {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                </button>
              )}
              <button
                className="px-4 py-2 rounded-full text-sm font-medium border border-default-200 hover:bg-default-100 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href)
                  // Optional: Show toast
                }}
              >
                Copy Link
              </button>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button className="text-xs font-medium underline" onClick={resetError}>
                dismiss
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center relative">
          {isHost ? (
            localStream ? (
              <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
            ) : (
              <p className="text-white/60 text-sm">Start the stream to preview your broadcast.</p>
            )
          ) : remoteStream ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
              {remotePlaybackBlocked && (
                <div className="absolute inset-0 bg-black/80 text-white flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm">Your browser blocked autoplay for this stream.</p>
                  <button
                    className="px-4 py-2 rounded-full bg-primary-500 hover:bg-primary-600 text-sm font-semibold transition-colors"
                    onClick={ensureRemotePlayback}
                  >
                    Play Stream
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/70 text-sm">
              <p>{viewerWaitingMessage}</p>
            </div>
          )}
          </div>
          <div className="mt-3 rounded-xl border border-default-200 bg-default-100/80 p-3 text-xs text-default-500 text-left flex flex-col h-48">
            <div className="flex items-center justify-between pb-2 border-b border-default-200/50 mb-2">
              <p className="font-semibold text-default-600">Room Activity</p>
              <span className="text-[10px] uppercase tracking-wider opacity-60">Live Updates</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {roomLogs.length === 0 ? (
                <p className="text-center py-4 opacity-50 italic">No activity yet</p>
              ) : (
                roomLogs.map((entry) => (
                  <div key={entry.id} className="flex gap-2 items-start">
                    <span className="opacity-40 font-mono whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    <span className="text-default-700">{entry.message}</span>
                  </div>
                ))
              )}
              {/* Auto-scroll anchor */}
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
