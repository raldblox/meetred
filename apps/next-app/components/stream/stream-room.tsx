'use client'

/* eslint-disable jsx-a11y/media-has-caption */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Chip, useDisclosure } from '@heroui/react'
import { Gift, LucideCircleStop, PlaySquareIcon, ScreenShareIcon, ScreenShareOffIcon, Share2, X } from 'lucide-react'

import { ThemeSwitch } from '../ui/theme-switch'
import { ShareRoomModal } from '../ui/share-room-modal'

import { StreamChatPanel } from './stream-chat-panel'

import { useStreamContext } from '@/context/stream-ctx'
import { INVITE_CARD_COPY, STREAM_ROOM_COPY } from '@/config/copy'
import { useSessionTimer } from '@/hooks/useSessionTimer'
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
  const { isOpen: isShareModalOpen, onOpen: openShareModal, onOpenChange: onShareModalOpenChange } = useDisclosure()
  const sessionTimer = useSessionTimer()
  const allowSessionStart = true // Master gate: future wallet/entitlement check

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

  const lastTimerStateRef = useRef(false)
  useEffect(() => {
    const shouldRun =
      allowSessionStart &&
      (isHost
        ? status === 'live'
        : status === 'live' && Boolean(remoteStream)) // viewers pay only when consuming

    if (shouldRun && !lastTimerStateRef.current) {
      sessionTimer.reset()
      sessionTimer.start()
      lastTimerStateRef.current = true
    } else if (!shouldRun && lastTimerStateRef.current) {
      sessionTimer.stop()
      lastTimerStateRef.current = false
    }
  }, [allowSessionStart, isHost, remoteStream, sessionTimer, status])

  const viewerWaitingMessage = INVITE_CARD_COPY.stream.waiting.body

  const statusDescription = isHost
    ? status === 'live'
      ? 'You are live now. Viewers will join automatically.'
      : status === 'starting'
        ? 'Allow your browser to use the camera and microphone to go live.'
        : status === 'error'
          ? 'Resolve the error below to restart your stream.'
          : STREAM_ROOM_COPY.controls.hostHint
    : status === 'live'
      ? 'Enjoy the live stream.'
      : viewerWaitingMessage
  const shareableLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.origin)
    url.pathname = `/stream/${streamId}`
    if (!url.searchParams.has('autoplay')) {
      url.searchParams.set('autoplay', 'true')
    }
    return url.toString()
  }, [streamId])

  return (
    <div className="flex flex-col h-full">
      <nav className="flex items-center justify-between w-full h-12">
        <div className="flex items-center gap-3">
          <h1 className="text-lg flex items-center font-semibold text-default-800 gap-2">
            {STREAM_ROOM_COPY.header.titlePrefix}: <span className="font-medium uppercase">{streamId.slice(-7)}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Chip className="font-mono" size="sm" variant="flat">
            {sessionTimer.formatted}
          </Chip>
          <Button
            isIconOnly
            aria-label="Share stream room"
            className="border border-default-200"
            radius="full"
            startContent={<Share2 className="h-4 w-4" />}
            variant="light"
            onPress={openShareModal}
          />
          {/* <ThemeSwitch /> */}
        </div>
      </nav>

      <div className="flex-1 w-full flex flex-col min-h-0 py-0">
        <div className="grid flex-1 min-h-0 !gap-6 lg:grid-cols-6">
          <aside className="order-1 lg:grid-cols-1 rounded-2xl bg-default-50 p-4 text-xs text-default-500 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2 border-b border-default-200/50 mb-2">
              <p className="text-sm font-semibold text-default-700">{STREAM_ROOM_COPY.activity.title}</p>
              <span className="text-[10px] uppercase tracking-wider opacity-60">Live Updates</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {roomLogs.length === 0 ? (
                <p className="text-center py-4 opacity-50 italic">{STREAM_ROOM_COPY.activity.empty}</p>
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

          <section className="order-2 lg:col-span-4 relative rounded-3xl border border-default-100 bg-default-900/5 min-h-[360px] flex flex-col">
            <div className="relative flex-1 min-h-0 flex items-center justify-center rounded-3xl bg-default-950/5 overflow-hidden">
              {isHost ? (
                localStream ? (
                  <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col gap-3 justify-center items-center mx-auto max-w-md text-center">
                    <p className="text-xl ">{STREAM_ROOM_COPY.centerEmptyHost.title}</p>
                    <p className="text-xs text-default-500">{STREAM_ROOM_COPY.centerEmptyHost.body}</p>
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

          <div className="order-3 flex flex-col gap-4 min-h-0">
            <div className="rounded-2xl bg-default-50 shadow-sm p-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold text-default-700">{STREAM_ROOM_COPY.controls.title}</p>
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
                    {status === 'live' ? STREAM_ROOM_COPY.controls.stop : STREAM_ROOM_COPY.controls.start}
                  </Button>

                  <Button
                    color={isScreenSharing ? 'danger' : 'default'}
                    disabled={status !== 'live'}
                    radius="full"
                    startContent={isScreenSharing ? <ScreenShareOffIcon /> : <ScreenShareIcon />}
                    onPress={toggleScreenShare}
                  >
                    {isScreenSharing ? 'Stop sharing' : STREAM_ROOM_COPY.controls.shareScreen}
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
      <ShareRoomModal
        isOpen={isShareModalOpen}
        roomType="stream"
        shareUrl={shareableLink}
        subtitle="Post or copy the link so people can hop into the stream."
        title="Share stream room"
        onOpenChange={onShareModalOpenChange}
      />
    </div>
  )
}
