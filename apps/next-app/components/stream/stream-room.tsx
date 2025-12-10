'use client'

/* eslint-disable jsx-a11y/media-has-caption */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Alert, Button, Chip } from '@heroui/react'
import { Gift, LucideCircleStop, PlaySquareIcon, ScreenShareIcon, ScreenShareOffIcon, X } from 'lucide-react'

import { ThemeSwitch } from '../ui/theme-switch'

import { StreamChatPanel } from './stream-chat-panel'

import { useStreamContext } from '@/context/stream-ctx'
import { forComponent } from '@/lib/logger'

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
    <div className="flex flex-col h-screen bg-default-50/50">
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
      <div className="h-10 bg-default-50 w-full border-b border-default-100" />
      <div className="flex-1 mx-auto container flex flex-col min-h-0 p-4 pb-4">
        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="order-2 lg:order-none rounded-2xl bg-default-50 p-4 text-xs text-default-500 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-default-200/50 mb-2">
              <p className="text-sm font-semibold text-default-700">Activity Log</p>
              <span className="text-[10px] uppercase tracking-wider opacity-60">Live Updates</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {roomLogs.length === 0 ? (
                <p className="text-center py-4 opacity-50 italic">No activity yet</p>
              ) : (
                roomLogs.map((entry) => (
                  <div key={entry.id} className="flex gap-2 items-start">
                    <span className="opacity-40 font-mono whitespace-nowrap min-w-[50px]">
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
                  <div className="flex flex-col gap-3 justify-center items-center mx-auto max-w-md text-center">
                    <p className="text-xl ">You&apos;re about to go live</p>
                    <p className="text-xs text-default-500">
                      When you start streaming, a link to this room will appear in the public room and people will see a
                      preview card there. Chat messages from here can also echo to the public room to help others
                      discover you.
                    </p>
                  </div>
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
            {/* status */}
            {status === 'live' && (
              <div className="absolute w-fit h-10 inset-x-6 top-6 left-6">
                <Chip className="font-mono" color="primary" size="sm" variant="dot">
                  LIVE
                </Chip>
              </div>
            )}
          </section>

          <div className="order-3 lg:order-none flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl bg-default-50 shadow-sm p-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-default-700">Stream Controls</p>
                <p className="text-xs text-default-500">{statusDescription}</p>
              </div>
              {isHost ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    color="primary"
                    disabled={status === 'starting'}
                    radius="full"
                    startContent={status === 'live' ? <LucideCircleStop /> : <PlaySquareIcon />}
                    onPress={status === 'live' ? stopHosting : startHosting}
                  >
                    {status === 'live' ? 'Stop Stream' : 'Start stream'}
                  </Button>

                  <Button
                    color={isScreenSharing ? 'danger' : 'default'}
                    disabled={status !== 'live'}
                    radius="full"
                    startContent={isScreenSharing ? <ScreenShareOffIcon /> : <ScreenShareIcon />}
                    onPress={toggleScreenShare}
                  >
                    {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                  </Button>

                  {/* <Button
                    className="px-4 py-2 rounded-full text-sm font-medium border border-default-200 hover:bg-default-100 transition-colors"
                    onPress={() => navigator.clipboard.writeText(window.location.href)}
                  >
                    Copy Link
                  </Button> */}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-wrap gap-3">
                  <Button radius="full" startContent={<Gift />}>
                    Support the host
                  </Button>
                </div>
              )}
              {error && (
                <Alert
                  className="mt-2 text-xs"
                  color="danger"
                  endContent={
                    <Button isIconOnly color="danger" size="sm" variant="solid" onPress={resetError}>
                      <X />
                    </Button>
                  }
                  variant="bordered"
                >
                  {error}
                </Alert>
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
