'use client'

/* eslint-disable jsx-a11y/media-has-caption */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

import { ThemeSwitch } from '../ui/theme-switch'

import { StreamChatPanel } from './stream-chat-panel'

import { useStreamContext } from '@/context/stream-ctx'
import { forComponent } from '@/lib/logger'
import { Button } from '@heroui/react'
import { LucideSpeaker, Speaker } from 'lucide-react'

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
  const [viewerAudioEnabled, setViewerAudioEnabled] = useState(true)
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
      <nav className="flex items-center justify-between w-full px-3 h-10 border-b border-default-100">
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
      <div className="h-10 bg-default-50 w-full border-b border-default-100"></div>
      <div className="flex-1 mx-auto container flex flex-col min-h-0 p-4 pb-4">
        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="order-2 lg:order-none rounded-2xl bg-default-50 p-4 text-xs text-default-500 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-default-200/50 mb-2">
              <p className="font-semibold text-default-600">Room Activity</p>
              <span className="text-[10px] uppercase tracking-wider opacity-60">Live Updates</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
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
          </aside>

          <section className="order-1 lg:order-none relative rounded-3xl border border-default-100 bg-default-900/5 min-h-[360px] flex flex-col">
            <div className="relative flex-1 min-h-0 flex items-center justify-center rounded-3xl bg-default-950/5 overflow-hidden">
              {isHost ? (
                localStream ? (
                  <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
                ) : (
                  <p className="text-sm text-default-500">Start the stream to preview your broadcast.</p>
                )
              ) : remoteStream ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                    muted={!viewerAudioEnabled}
                  />
                  {!viewerAudioEnabled && (
                    <div className="absolute bottom-6 right-6">
                      <Button radius="full" size="sm" onPress={handleEnableAudio}>
                        Enable Sound
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm text-default-500">
                  <p>{viewerWaitingMessage}</p>
                </div>
              )}
            </div>
            {/* controls */}
            <div className="absolute w-fit h-10 inset-x-6 top-6 left-6">
              <div className="flex items-center gap-3 rounded-md bg-default-200/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-lg">
                <span
                  className={`h-2 w-2 rounded-full ${
                    status === 'live' ? 'bg-danger-400 animate-pulse' : 'bg-default-200'
                  }`}
                />
                {status === 'live' ? 'Live' : isHost ? 'Preview' : 'Waiting'}
              </div>
            </div>
          </section>

          <div className="order-3 lg:order-none flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl bg-default-50 shadow-sm p-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-default-700">Stream Controls</p>
                <p className="text-xs text-default-500">{statusDescription}</p>
              </div>
              {isHost ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    className="px-5 py-2 rounded-full text-sm font-semibold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-60 transition-colors"
                    disabled={status === 'starting'}
                    onClick={status === 'live' ? stopHosting : startHosting}
                  >
                    {status === 'live' ? 'Stop Stream' : 'Go Live'}
                  </button>
                  <button
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
                      isScreenSharing ? 'bg-red-500 text-white' : 'bg-default-100 text-default-800'
                    }`}
                    disabled={status !== 'live'}
                    onClick={toggleScreenShare}
                  >
                    {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                  </button>
                  <button
                    className="px-4 py-2 rounded-full text-sm font-medium border border-default-200 hover:bg-default-100 transition-colors"
                    onClick={() => navigator.clipboard.writeText(window.location.href)}
                  >
                    Copy Link
                  </button>
                </div>
              ) : (
                <p className="text-sm text-default-500">Only the host can control stream settings. Enjoy the show!</p>
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
            <div className="flex-1 min-h-0">
              <StreamChatPanel streamId={streamId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
