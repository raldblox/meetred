'use client'

/* eslint-disable jsx-a11y/media-has-caption */

import { useEffect, useRef, useState } from 'react'

import { Navbar } from '@/components/ui/navbar'
import { useStreamContext } from '@/context/stream-ctx'
import { forComponent } from '@/lib/logger'
import { ThemeSwitch } from '../ui/theme-switch'
import Link from 'next/link'
import Image from 'next/image'

const log = forComponent('stream-room')

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
    roomLogs,
    startViewing,
    stopViewing,
    isScreenSharing,
    toggleScreenShare,
  } = useStreamContext()

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const [viewerAudioEnabled, setViewerAudioEnabled] = useState(false)
  const viewerStartedRef = useRef(false)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    } else if (localVideoRef.current && !localStream) {
      localVideoRef.current.srcObject = null
    }
  }, [localStream])

  useEffect(() => {
    const video = remoteVideoRef.current

    if (video && remoteStream) {
      video.srcObject = remoteStream
      video.muted = !viewerAudioEnabled
      const playPromise = video.play()

      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // Ignore autoplay rejections; user can start audio via UI.
        })
      }
    } else if (video && !remoteStream) {
      video.srcObject = null
      setViewerAudioEnabled(false)
    }
  }, [remoteStream, viewerAudioEnabled])

  useEffect(() => {
    const video = remoteVideoRef.current

    if (!video) {
      return
    }

    video.muted = !viewerAudioEnabled

    if (viewerAudioEnabled) {
      const playPromise = video.play()

      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // If unmuted playback fails, revert and let user try again.
          video.muted = true
          setViewerAudioEnabled(false)
        })
      }
    }
  }, [viewerAudioEnabled])

  const handleEnableAudio = () => {
    setViewerAudioEnabled(true)
  }

  useEffect(() => {
    if (isHost) {
      return
    }

    if (status === 'idle' && !viewerStartedRef.current) {
      viewerStartedRef.current = true
      startViewing().catch((error) => {
        log.error('viewer failed to start room stream %o', error)
        viewerStartedRef.current = false
      })
    }
  }, [isHost, startViewing, status])

  useEffect(() => {
    return () => {
      viewerStartedRef.current = false
      if (!isHost) {
        stopViewing()
      }
    }
  }, [isHost, stopViewing])

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
    <div className="flex flex-col min-h-screen bg-default-50/50">
      <nav className="flex items-center justify-between w-full pt-2 px-3">
        <div className="flex items-center gap-3">
          <Link className="flex justify-start items-center gap-2" href="/">
            <Image alt="metered logo" className={`text-foreground`} height="16" src="/metered.svg" width="16" />
            <h1 className="font-semibold text-sm uppercase text-default-500">
              Stream: <span className="font-medium">{streamId.slice(-7)}</span>
            </h1>
          </Link>
        </div>

        <ThemeSwitch />
      </nav>
      <div className="flex-1 mx-auto container min-h-0 p-2 pb-4 flex flex-col gap-4">
        <div className="flex-1 min-h-0 flex flex-col gap-4 lg:flex-row">
          <div className="flex-1 rounded-xl bg-default-50 flex items-center justify-center">
            <div className="relative flex h-full w-full items-center justify-center">
              <div className="relative flex h-full w-full items-center justify-center rounded-xl bg-default-50">
                {isHost ? (
                  localStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <p className="text-sm">Start the stream to preview your broadcast.</p>
                  )
                ) : remoteStream ? (
                  <>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="max-h-full max-w-full object-contain"
                      muted={!viewerAudioEnabled}
                    />
                    {!viewerAudioEnabled && (
                      <div className="absolute bottom-4 right-4 rounded-full shadow-lg">
                        <button
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                          onClick={handleEnableAudio}
                        >
                          Enable Sound
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-sm">
                    <p>{viewerWaitingMessage}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-80 flex-shrink-0 rounded-xl bg-default-50 p-4 text-xs text-default-500 flex flex-col">
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
              <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-default-50 shadow-sm p-6 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-default-500 text-balance">{statusDescription}</p>

          {isHost && (
            <div className="flex items-center gap-3">
              <button
                className="px-6 py-2 rounded-full text-sm font-semibold bg-primary-500 hover:bg-primary-600 disabled:opacity-60 transition-colors"
                disabled={status === 'starting'}
                onClick={status === 'live' ? stopHosting : startHosting}
              >
                {status === 'live' ? 'Stop Stream' : 'Start Stream'}
              </button>
              {status === 'live' && (
                <button
                  className={`px-6 py-2 rounded-full text-sm font-semibold transition-colorse ${
                    isScreenSharing ? 'bg-red-500 hover:bg-red-600' : 'bg-default-100 hover:bg-default-100'
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
      </div>
    </div>
  )
}
