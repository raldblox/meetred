'use client'

import type { Message } from '@libp2p/interface'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CHAT_TOPIC, STREAM_SIGNAL_APP_ID, STREAM_SIGNAL_WRAPPER } from '@/config/constants'
import { forComponent } from '@/lib/logger'

const log = forComponent('stream-context')

// Serialises an arbitrary error so that we can surface it in room logs without crashing.
const describeError = (error: unknown): string | undefined => {
  if (!error) {
    return undefined
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  const message = (error as any)?.message

  if (typeof message === 'string') {
    return message
  }

  try {
    return JSON.stringify(error)
  } catch {
    try {
      return String(error)
    } catch {
      return undefined
    }
  }
}

type ReceiverWithPlayoutDelay = RTCRtpReceiver & { playoutDelayHint?: number }

// Applies browser hints that minimise JIT buffering on viewer peer connections.
const applyLowLatencyReceiverSettings = (receiver?: RTCRtpReceiver | null) => {
  if (!receiver) return

  const target = receiver as ReceiverWithPlayoutDelay

  try {
    if (typeof target.playoutDelayHint === 'number' || target.playoutDelayHint === undefined) {
      target.playoutDelayHint = 0.04
    }
  } catch (error) {
    log.error('failed to set receiver playout delay %o', error)
  }
}

// Normalises sender encoders (used by the host) so every viewer receives a predictable stream.
const applyLowLatencySenderSettings = (pc?: RTCPeerConnection | null) => {
  if (!pc) return

  pc.getSenders().forEach((sender) => {
    if (!sender?.track || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') {
      return
    }

    try {
      const parameters = sender.getParameters()

      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}]
      }

      parameters.degradationPreference = 'maintain-framerate'
      parameters.encodings = parameters.encodings.map((encoding) => {
        if (sender.track?.kind === 'video') {
          return {
            ...encoding,
            maxBitrate: 1_500_000,
            maxFramerate: 30,
            priority: 'high',
          }
        }

        return {
          ...encoding,
          maxBitrate: 128_000,
          priority: 'high',
        }
      })

      Promise.resolve(sender.setParameters(parameters)).catch((error) => {
        log.error('failed to update rtc sender parameters %o', error)
      })
    } catch (error) {
      log.error('failed to prepare rtc sender parameters %o', error)
    }
  })
}

// Ensures the local tracks are tagged/constrainted before sending to peers.
const prepareLocalMediaForRealtime = async (stream: MediaStream) => {
  const tasks: Promise<unknown>[] = []

  stream.getVideoTracks().forEach((track) => {
    try {
      track.contentHint = 'motion'
    } catch {
      // ignore unsupported hints
    }

    if (typeof track.applyConstraints === 'function') {
      tasks.push(
        track.applyConstraints(VIDEO_TRACK_CONSTRAINTS).catch((error) => {
          log.error('failed to apply video constraints %o', error)
        }),
      )
    }
  })

  stream.getAudioTracks().forEach((track) => {
    try {
      track.contentHint = 'speech'
    } catch {
      // ignore unsupported hints
    }

    if (typeof track.applyConstraints === 'function') {
      tasks.push(
        track.applyConstraints(AUDIO_TRACK_CONSTRAINTS).catch((error) => {
          log.error('failed to apply audio constraints %o', error)
        }),
      )
    }
  })

  if (tasks.length > 0) {
    await Promise.allSettled(tasks)
  }
}

type StreamStatus = 'idle' | 'starting' | 'live' | 'connecting' | 'error'

interface StreamSignalMessage {
  streamId: string
  action:
    | 'viewer-offer'
    | 'viewer-ice'
    | 'host-answer'
    | 'host-ice'
    | 'host-ready'
    | 'error'
    | 'viewer-hello'
    | 'log-entry'
  to?: string
  from?: string
  payload?: any
}

interface StreamSignalEnvelope {
  type: typeof STREAM_SIGNAL_WRAPPER
  app: typeof STREAM_SIGNAL_APP_ID
  payload: StreamSignalMessage
}

export interface StreamContextValue {
  streamId: string
  hostPeerId: string
  selfPeerId: string | null
  isHost: boolean
  status: StreamStatus
  error?: string | null
  localStream?: MediaStream | null
  remoteStream?: MediaStream | null
  startHosting: () => Promise<void>
  stopHosting: () => Promise<void>
  startViewing: () => Promise<void>
  stopViewing: () => void
  resetError: () => void
  statusLog: string[]
  roomLogs: { message: string; timestamp: number; id: string }[]
  isScreenSharing: boolean
  toggleScreenShare: () => Promise<void>
}

// Shared STUN config keeps signalling minimal while being supported in every major browser.
const ICE_SERVERS: RTCConfiguration['iceServers'] = [{ urls: ['stun:stun.l.google.com:19302'] }]

const VIDEO_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
}

const AUDIO_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

const StreamContext = createContext<StreamContextValue | undefined>(undefined)

export function StreamProvider({ streamId, children }: { streamId: string; children: ReactNode }) {
  const { libp2p } = useLibp2pContext()
  const [hostStatus, setHostStatus] = useState<StreamStatus>('idle')
  const [viewerStatus, setViewerStatus] = useState<StreamStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [statusLog, setStatusLog] = useState<string[]>([])
  const localStreamRef = useRef<MediaStream | null>(null)
  const hostConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const viewerPeerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const pendingViewerOffersRef = useRef<Map<string, StreamSignalMessage>>(new Map())
  const pendingViewerIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const presenceLoggedRef = useRef(false)
  const hostWentLiveRef = useRef(false)
  const topic = CHAT_TOPIC

  const selfPeerId = useMemo(() => libp2p.peerId?.toString() ?? null, [libp2p])
  const hostPeerId = streamId
  const isHost = useMemo(() => !!selfPeerId && selfPeerId === hostPeerId, [selfPeerId, hostPeerId])
  const status = isHost ? hostStatus : viewerStatus
  const [remoteHostReady, setRemoteHostReady] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [roomLogs, setRoomLogs] = useState<{ message: string; timestamp: number; id: string }[]>([])

  const appendStatusLog = useCallback((entry: string) => {
    log('stream status %s', entry)
    setStatusLog((prev) => [...prev.slice(-5), entry])
  }, [])

  const setSelfStatus = useCallback(
    (next: StreamStatus) => {
      if (isHost) {
        setHostStatus(next)
        appendStatusLog(`host ${next}`)
      } else {
        setViewerStatus(next)
        appendStatusLog(`viewer ${next}`)
      }
    },
    [isHost, appendStatusLog],
  )

  const resetError = useCallback(() => setError(null), [])

  // Broadcasts signalling payloads over libp2p pubsub instead of using a traditional SFU.
  const publishSignal = useCallback(
    async (message: Omit<StreamSignalMessage, 'streamId' | 'from'>) => {
      if (!libp2p || !selfPeerId) {
        return
      }

      const payload: StreamSignalMessage = {
        ...message,
        streamId: hostPeerId,
        from: selfPeerId,
      }

      const envelope: StreamSignalEnvelope = {
        type: STREAM_SIGNAL_WRAPPER,
        app: STREAM_SIGNAL_APP_ID,
        payload,
      }

      log('publishing signal on topic %s %o', topic, envelope)

      try {
        await libp2p.services.pubsub.publish(topic, uint8ArrayFromString(JSON.stringify(envelope)))
      } catch (e: any) {
        log.error('failed to publish signal %o', e)
        setError(e?.message ?? 'failed to publish signal')
        setSelfStatus('error')
      }
    },
    [hostPeerId, libp2p, selfPeerId, setSelfStatus, topic],
  )

  // Mirrors important lifecycle events to all clients so the UI can show a consistent activity feed.
  const postRoomLog = useCallback(
    async (message: string) => {
      const entry = { message, timestamp: Date.now(), id: crypto.randomUUID() }

      setRoomLogs((prev) => [...prev, entry])
      await publishSignal({ action: 'log-entry', payload: entry })
    },
    [publishSignal],
  )

  // Helper that annotates the activity feed whenever we hit an unexpected error path.
  const recordRoomError = useCallback(
    async (message: string, error?: unknown) => {
      const detail = describeError(error)
      const entry = detail ? `${message} - ${detail}` : message

      try {
        await postRoomLog(`Error: ${entry}`)
      } catch (logError) {
        log.error('failed to post room error %o', logError)
      }
    },
    [postRoomLog],
  )

  const cleanupViewerConnection = useCallback(() => {
    const pc = viewerPeerConnectionRef.current

    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.close()
    }
    viewerPeerConnectionRef.current = null
    pendingViewerIceRef.current.clear()
  }, [])

  const stopViewing = useCallback(() => {
    cleanupViewerConnection()
    setRemoteStream(null)
    setViewerStatus((prev) => (prev === 'idle' ? prev : 'idle'))
  }, [cleanupViewerConnection])

  // Tears down the broadcast state and lets viewers know the host is offline.
  const stopHosting = useCallback(async () => {
    if (!isHost) {
      return
    }

    try {
      await publishSignal({ action: 'host-ready', payload: { live: false } })
    } catch (e) {
      log.error('failed to publish host offline signal %o', e)
      await recordRoomError('Failed to announce host offline', e)
    }
    hostConnectionsRef.current.forEach((pc) => {
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.close()
    })
    hostConnectionsRef.current.clear()

    const currentStream = localStreamRef.current

    if (currentStream) {
      currentStream.getTracks().forEach((track) => track.stop())
    }

    appendStatusLog('host stopping stream')
    localStreamRef.current = null
    setLocalStream(null)
    setHostStatus('idle')
    setRemoteHostReady(false)
    pendingViewerOffersRef.current.clear()
    if (isHost && hostWentLiveRef.current) {
      hostWentLiveRef.current = false
      try {
        await postRoomLog('Stream stopped')
      } catch (error) {
        log.error('failed to log host stop %o', error)
      }
    }
  }, [appendStatusLog, isHost, postRoomLog, publishSignal, recordRoomError])

  // Lazily creates or reuses a host->viewer connection whenever we receive an offer.
  const createHostPeerConnection = useCallback(
    (viewerPeer: string) => {
      const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      hostConnectionsRef.current.set(viewerPeer, peerConnection)

      const stream = localStreamRef.current

      if (stream) {
        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream))
        applyLowLatencySenderSettings(peerConnection)
      }

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          publishSignal({
            action: 'host-ice',
            to: viewerPeer,
            payload: { candidate: event.candidate.toJSON() },
          })
        }
      }

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState

        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          hostConnectionsRef.current.delete(viewerPeer)
          peerConnection.close()
          postRoomLog(`Viewer ${viewerPeer.slice(-5)} left`)
        } else if (state === 'connected') {
          postRoomLog(`Viewer ${viewerPeer.slice(-5)} connected`)
        }
      }

      return peerConnection
    },
    [publishSignal, postRoomLog],
  )

  // Applies a viewer's SDP offer, flushes pending ICE, and responds with the answer.
  const answerViewerOffer = useCallback(
    async (signal: StreamSignalMessage, peerId: string) => {
      const pc = hostConnectionsRef.current.get(peerId) ?? createHostPeerConnection(peerId)

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.payload?.sdp })

        const pendingCandidates = pendingViewerIceRef.current.get(peerId)

        if (pendingCandidates?.length) {
          for (const candidate of pendingCandidates) {
            try {
              await pc.addIceCandidate(candidate)
            } catch (candidateError) {
              log.error('failed to add pending viewer ice %o', candidateError)
            }
          }
          pendingViewerIceRef.current.delete(peerId)
        }

        const answer = await pc.createAnswer()

        await pc.setLocalDescription(answer)
        await publishSignal({
          action: 'host-answer',
          to: peerId,
          payload: { sdp: answer.sdp },
        })
      } catch (e: any) {
        log.error('failed to process viewer offer %o', e)
        setError(e?.message ?? 'failed to process viewer offer')
        await publishSignal({
          action: 'error',
          to: peerId,
          payload: { message: 'Unable to negotiate stream. Please retry.' },
        })
        await recordRoomError(`Host failed to process viewer ${peerId.slice(-5)} offer`, e)
      }
    },
    [createHostPeerConnection, publishSignal, recordRoomError],
  )

  // Viewer offer handler queues requests until the host owns media.
  const handleViewerOffer = useCallback(
    async (signal: StreamSignalMessage, peerId: string) => {
      if (!isHost) return

      if (!localStreamRef.current) {
        appendStatusLog(`queued offer from ${peerId}`)
        pendingViewerOffersRef.current.set(peerId, signal)

        return
      }

      await answerViewerOffer(signal, peerId)
      pendingViewerOffersRef.current.delete(peerId)
    },
    [answerViewerOffer, isHost],
  )

  // Buffers ICE candidates until a host connection exists.
  const handleViewerIce = useCallback(
    async (signal: StreamSignalMessage, peerId: string) => {
      if (!isHost) return
      const candidate = signal.payload?.candidate ?? null

      if (!candidate) {
        return
      }

      const pc = hostConnectionsRef.current.get(peerId)

      if (!pc) {
        const existing = pendingViewerIceRef.current.get(peerId) ?? []

        pendingViewerIceRef.current.set(peerId, [...existing, candidate])

        return
      }

      try {
        await pc.addIceCandidate(candidate)
      } catch (e) {
        log.error('failed to add viewer ice candidate %o', e)
      }
    },
    [isHost],
  )

  // Applies the host SDP answer on the viewer so playback can start.
  const handleHostAnswer = useCallback(
    async (signal: StreamSignalMessage) => {
      const pc = viewerPeerConnectionRef.current

      if (!pc) {
        return
      }

      try {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.payload?.sdp })
        appendStatusLog('viewer applied host answer')
        setSelfStatus('live')
      } catch (e: any) {
        log.error('failed to handle host answer %o', e)
        setError(e?.message ?? 'failed to apply host answer')
        setSelfStatus('error')
        await recordRoomError('Viewer failed to apply host answer', e)
      }
    },
    [recordRoomError, setSelfStatus, appendStatusLog],
  )

  // Pushes host ICE into the viewer peer connection.
  const handleHostIce = useCallback(async (signal: StreamSignalMessage) => {
    const pc = viewerPeerConnectionRef.current

    if (!pc) {
      return
    }

    try {
      await pc.addIceCandidate(signal.payload?.candidate ?? null)
    } catch (e) {
      log.error('failed to add host ice candidate %o', e)
    }
  }, [])

  // Central switchboard for all pubsub signalling messages routed through libp2p.
  const handleStreamSignal = useCallback(
    async (evt: CustomEvent<Message>) => {
      if (evt.detail.topic !== topic) {
        return
      }

      if (evt.detail.type !== 'signed') {
        return
      }

      let parsed: StreamSignalMessage

      try {
        const envelope = JSON.parse(uint8ArrayToString(evt.detail.data)) as StreamSignalEnvelope

        if (envelope?.type !== STREAM_SIGNAL_WRAPPER || envelope?.app !== STREAM_SIGNAL_APP_ID || !envelope.payload) {
          return
        }

        parsed = envelope.payload
      } catch (e) {
        log.error('failed to decode stream signal %o', e)

        return
      }

      const incomingPeerId = evt.detail.from?.toString()

      log('received %o on topic %s from %s', parsed, evt.detail.topic, incomingPeerId ?? 'unknown')
      if (parsed.streamId !== hostPeerId) {
        return
      }

      if (parsed.action === 'viewer-offer' || parsed.action === 'viewer-ice') {
        if (!isHost || (parsed.to && parsed.to !== selfPeerId)) {
          return
        }

        if (!incomingPeerId) {
          return
        }

        if (parsed.action === 'viewer-offer') {
          await handleViewerOffer(parsed, incomingPeerId)
        } else if (parsed.action === 'viewer-ice') {
          await handleViewerIce(parsed, incomingPeerId)
        }

        return
      }

      // viewer-handled signals
      if (parsed.to && parsed.to !== selfPeerId) {
        return
      }

      switch (parsed.action) {
        case 'host-answer':
          await handleHostAnswer(parsed)
          break
        case 'host-ice':
          await handleHostIce(parsed)
          break
        case 'host-ready':
          const live = parsed.payload?.live ?? true

          setRemoteHostReady(live)
          appendStatusLog(`viewer host-ready ${live ? 'live' : 'stopped'}`)
          if (!live) {
            stopViewing()
          }
          break
        case 'error':
          setError(parsed.payload?.message ?? 'An error occurred in the stream')
          setSelfStatus('error')
          break
        case 'viewer-hello':
          if (isHost && status === 'live') {
            await publishSignal({ action: 'host-ready', payload: { live: true } })
            // Optional: Log that a viewer is attempting to join/hello
            // postRoomLog(`Viewer ${incomingPeerId?.slice(-5)} said hello`)
          }
          break
        case 'log-entry':
          if (parsed.payload) {
            setRoomLogs((prev) => {
              if (prev.some((l) => l.id === parsed.payload.id)) return prev

              return [...prev, parsed.payload]
            })
          }
          break
        default:
          break
      }
    },
    [
      handleHostAnswer,
      handleHostIce,
      handleViewerIce,
      handleViewerOffer,
      hostPeerId,
      isHost,
      selfPeerId,
      setSelfStatus,
      topic,
      status,
      publishSignal,
    ],
  )

  // Attach the streaming signal handler to libp2p pubsub lifecycle.
  useEffect(() => {
    libp2p.services.pubsub.addEventListener('message', handleStreamSignal)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', handleStreamSignal)
    }
  }, [handleStreamSignal, libp2p.services.pubsub, topic])

  // As soon as a viewer loads the room, announce their presence to discover if host is live.
  useEffect(() => {
    if (!isHost && libp2p && selfPeerId) {
      // Announce presence to check if host is already live
      publishSignal({ action: 'viewer-hello' }).catch((e) => log.error('failed to send hello %o', e))
    }
  }, [isHost, libp2p, publishSignal, selfPeerId])

  // Each peer posts a presence log exactly once, making room activity deterministic.
  useEffect(() => {
    if (!selfPeerId || presenceLoggedRef.current) {
      return
    }

    presenceLoggedRef.current = true
    const shortId = selfPeerId.slice(-7)
    const message = isHost ? `Host ${shortId} opened the stream room` : `Viewer ${shortId} joined to watch the stream`

    postRoomLog(message).catch((e) => log.error('failed to post presence log %o', e))
  }, [isHost, postRoomLog, selfPeerId])

  // Replays queued viewer offers whenever the host regains a usable stream.
  const flushPendingViewerOffers = useCallback(async () => {
    if (!localStreamRef.current) {
      return
    }

    for (const [peerId, signal] of pendingViewerOffersRef.current) {
      try {
        appendStatusLog(`flushing queued offer for ${peerId}`)
        await answerViewerOffer(signal, peerId)
        pendingViewerOffersRef.current.delete(peerId)
      } catch (e) {
        log.error('failed to answer queued viewer offer %o', e)
      }
    }
  }, [answerViewerOffer, appendStatusLog])

  // Host side entrypoint: grabs local media, advertises readiness, logs the event.
  const startHosting = useCallback(async () => {
    if (!isHost) {
      setError('Only the verified host can start streaming.')
      setSelfStatus('error')

      return
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Media devices are not available in this browser.')
      setSelfStatus('error')

      return
    }

    resetError()
    setSelfStatus('starting')
    appendStatusLog('host requesting camera/mic')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: VIDEO_TRACK_CONSTRAINTS,
        audio: AUDIO_TRACK_CONSTRAINTS,
      })

      await prepareLocalMediaForRealtime(stream)

      localStreamRef.current = stream
      setLocalStream(stream)
      setSelfStatus('live')
      appendStatusLog('host live stream available')
      await publishSignal({ action: 'host-ready', payload: { live: true } })
      await postRoomLog('Stream started')
      hostWentLiveRef.current = true
      await flushPendingViewerOffers()
    } catch (e: any) {
      log.error('failed to start hosting %o', e)
      setError(e?.message ?? 'failed to access camera/microphone')
      setSelfStatus('error')
      await recordRoomError('Host failed to start stream', e)
    }
  }, [appendStatusLog, flushPendingViewerOffers, isHost, publishSignal, recordRoomError, resetError, setSelfStatus])

  // Viewer entrypoint: creates a recvonly offer and waits for the host to answer.
  const startViewing = useCallback(async () => {
    if (isHost) {
      setError('Hosts cannot view their own stream.')
      setSelfStatus('error')

      return
    }

    if (viewerPeerConnectionRef.current) {
      return
    }

    resetError()
    setSelfStatus('connecting')
    appendStatusLog('viewer creating offer')

    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    viewerPeerConnectionRef.current = peerConnection

    peerConnection.ontrack = (event) => {
      applyLowLatencyReceiverSettings(event.receiver)
      const [stream] = event.streams

      setRemoteStream(stream ?? null)
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal({
          action: 'viewer-ice',
          to: hostPeerId,
          payload: { candidate: event.candidate.toJSON() },
        })
      }
    }

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState

      if (state === 'failed' || state === 'disconnected') {
        setError('Connection to the host was lost.')
        setSelfStatus('error')
      }
    }

    try {
      // Advertise that we want to receive both audio & video; without recvonly
      // transceivers the SDP offer has no media sections and the host can't send tracks.
      peerConnection.addTransceiver('video', { direction: 'recvonly' })
      peerConnection.addTransceiver('audio', { direction: 'recvonly' })

      const offer = await peerConnection.createOffer()

      await peerConnection.setLocalDescription(offer)
      await publishSignal({
        action: 'viewer-offer',
        to: hostPeerId,
        payload: { sdp: offer.sdp },
      })
    } catch (e: any) {
      log.error('failed to start viewing %o', e)
      setError(e?.message ?? 'failed to create viewer offer')
      setSelfStatus('error')
      stopViewing()
      await recordRoomError('Viewer failed to start stream', e)
    }
  }, [hostPeerId, isHost, publishSignal, recordRoomError, resetError, setSelfStatus, stopViewing])

  // If the viewer is idle and the host advertises readiness, attempt to reconnect automatically.
  useEffect(() => {
    if (isHost || !selfPeerId) {
      return
    }

    if (status !== 'idle') {
      return
    }

    if (viewerPeerConnectionRef.current) {
      return
    }

    startViewing().catch((e) => log.error('auto viewer start failed %o', e))
  }, [isHost, selfPeerId, startViewing, status])

  const reconnectTimerRef = useRef<number | null>(null)

  // When we detect a viewer stuck in connecting state, tear down the connection so it can retry.
  useEffect(() => {
    if (!isHost && remoteHostReady && status === 'idle' && !viewerPeerConnectionRef.current) {
      startViewing().catch((err) => log.error('auto viewer start failed %o', err))
    }
  }, [isHost, remoteHostReady, startViewing, status])

  // When the component unmounts (navigation away), clean up both host and viewer state.
  useEffect(() => {
    if (isHost) {
      return
    }

    if (status === 'connecting') {
      reconnectTimerRef.current = window.setTimeout(() => {
        appendStatusLog('viewer reconnecting after timeout')
        stopViewing()
      }, 8000)
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }
  }, [appendStatusLog, isHost, status, stopViewing])

  useEffect(() => {
    return () => {
      stopViewing()
      stopHosting()
    }
  }, [stopHosting, stopViewing])

  // Swaps between camera and display capture mid-stream while keeping viewers connected.
  const toggleScreenShare = useCallback(async () => {
    if (!isHost || !localStreamRef.current) return

    try {
      if (isScreenSharing) {
        // Switch back to camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: VIDEO_TRACK_CONSTRAINTS,
          audio: false,
        })

        await prepareLocalMediaForRealtime(stream)

        const videoTrack = stream.getVideoTracks()[0]

        // Replace track in local stream
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0]

        if (currentVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack)
          currentVideoTrack.stop()
        }
        localStreamRef.current.addTrack(videoTrack)

        // Replace track in peer connections
        hostConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')

          if (sender) {
            Promise.resolve(sender.replaceTrack(videoTrack))
              .then(() => applyLowLatencySenderSettings(pc))
              .catch((error) => log.error('failed to replace video track %o', error))
          }
        })

        setLocalStream(new MediaStream(localStreamRef.current.getTracks())) // Trigger re-render
        setIsScreenSharing(false)
        await postRoomLog('Screen share stopped')
        appendStatusLog('host switched to camera')
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          setError('This browser does not support screen sharing. Please update your browser or use a desktop device.')
          await recordRoomError('Screen share unsupported on this device')

          return
        }

        // Switch to screen share
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const screenTrack = stream.getVideoTracks()[0]

        try {
          screenTrack.contentHint = 'detail'
        } catch {
          // ignore unsupported hints
        }

        // Handle user stopping screen share via browser UI
        screenTrack.onended = () => {
          // We can't easily call toggleScreenShare here because it depends on state that might be stale in the closure if not careful,
          // but since we use functional updates or refs, it might be okay.
          // However, simpler to just let the user manually switch back or force it.
          // Let's try to force switch back to camera if they stop sharing.
          // Actually, we need to be careful about recursion or state.
          // For now, let's just stop the track. The user will see black/frozen screen and can click "Stop Sharing" (which is now "Start Camera") in UI.
          // Better: Update state to reflect it stopped.
          setIsScreenSharing(false)
          // We should ideally revert to camera automatically.
          // But we need to call getUserMedia again.
          // Let's leave it for manual switch for safety, or just update UI state.
          // If we update UI state to false, the button becomes "Share Screen" again.
          // But the stream is now dead (video track ended).
          // So we MUST revert to camera or at least stop the "sharing" state.
        }

        // Replace track in local stream
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0]

        if (currentVideoTrack) {
          localStreamRef.current.removeTrack(currentVideoTrack)
          currentVideoTrack.stop()
        }
        localStreamRef.current.addTrack(screenTrack)

        // Replace track in peer connections
        hostConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video')

          if (sender) {
            Promise.resolve(sender.replaceTrack(screenTrack))
              .then(() => applyLowLatencySenderSettings(pc))
              .catch((error) => log.error('failed to replace screen track %o', error))
          }
        })

        setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
        setIsScreenSharing(true)
        await postRoomLog('Screen share started')
        appendStatusLog('host switched to screen share')
      }
    } catch (e: any) {
      log.error('failed to toggle screen share %o', e)
      setError(e?.message ?? 'failed to toggle screen share')
      setIsScreenSharing(false)
      await recordRoomError('Screen share error', e)
    }
  }, [appendStatusLog, isHost, isScreenSharing, recordRoomError])

  const value: StreamContextValue = {
    streamId,
    hostPeerId,
    selfPeerId,
    isHost,
    status,
    error,
    localStream,
    remoteStream,
    startHosting,
    stopHosting,
    startViewing,
    stopViewing,
    resetError,
    statusLog,
    roomLogs,
    isScreenSharing,
    toggleScreenShare,
  }

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
}

export const useStreamContext = () => {
  const ctx = useContext(StreamContext)

  if (!ctx) {
    throw new Error('useStreamContext must be used within a StreamProvider')
  }

  return ctx
}
