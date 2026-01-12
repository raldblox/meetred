'use client'

import type { Message } from '@libp2p/interface'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { CALL_SIGNAL_APP_ID, CALL_SIGNAL_TOPIC, CALL_SIGNAL_WRAPPER } from '@/config/constants'
import { forComponent } from '@/lib/logger'
import { decodeZeroWidth, encodeZeroWidth } from '@/lib/metered-envelope'

const log = forComponent('call-context')

type CallStatus = 'idle' | 'waiting' | 'calling' | 'ringing' | 'connecting' | 'in-call' | 'error'
type HostStatus = 'available' | 'busy'
type ParticipantStatus = 'waiting' | 'calling' | 'ringing' | 'in-call' | 'busy'

interface CallSignalMessage {
  callId: string
  action:
    | 'presence-join'
    | 'presence-leave'
    | 'host-status'
    | 'payment-rate'
    | 'call-offer'
    | 'call-answer'
    | 'call-ice'
    | 'call-end'
    | 'call-decline'
  to?: string
  from?: string
  payload?: any
}

interface CallSignalEnvelope {
  type: typeof CALL_SIGNAL_WRAPPER
  app: typeof CALL_SIGNAL_APP_ID
  payload: CallSignalMessage
}

export interface CallParticipant {
  peerId: string
  status: ParticipantStatus
  lastSeen: number
}

export interface CallContextValue {
  callId: string
  hostPeerId: string
  selfPeerId: string | null
  isHost: boolean
  status: CallStatus
  hostStatus: HostStatus
  participants: CallParticipant[]
  activePeerId: string | null
  error?: string | null
  localStream?: MediaStream | null
  remoteStream?: MediaStream | null
  isCameraEnabled: boolean
  isMicEnabled: boolean
  isScreenSharing: boolean
  toggleCamera: () => Promise<void>
  toggleMicrophone: () => Promise<void>
  toggleScreenShare: () => Promise<void>
  startCallWith: (peerId: string) => Promise<void>
  endCall: () => Promise<void>
  clearError: () => void
  paymentRate: number | null
  setPaymentRate: (rate: number) => void
}

const ICE_SERVERS: RTCConfiguration['iceServers'] = [{ urls: ['stun:stun.l.google.com:19302'] }]

const CallContext = createContext<CallContextValue | undefined>(undefined)

export function CallProvider({ callId, children }: { callId: string; children: ReactNode }) {
  const { libp2p } = useLibp2pContext()
  const [status, setStatus] = useState<CallStatus>('waiting')
  const [hostStatus, setHostStatus] = useState<HostStatus>('available')
  const [error, setError] = useState<string | null>(null)
  const [participantsMap, setParticipantsMap] = useState<Record<string, CallParticipant>>({})
  const [activePeerId, setActivePeerId] = useState<string | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isCameraEnabled, setIsCameraEnabled] = useState(false)
  const [isMicEnabled, setIsMicEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [paymentRate, setPaymentRateState] = useState<number | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const selfPeerId = useMemo(() => libp2p.peerId?.toString() ?? null, [libp2p])
  const hostPeerId = callId
  const isHost = useMemo(() => !!selfPeerId && selfPeerId === hostPeerId, [selfPeerId, hostPeerId])

  const publishSignal = useCallback(
    async (message: Omit<CallSignalMessage, 'callId' | 'from'>) => {
      if (!selfPeerId) return
      const payload: CallSignalMessage = { ...message, callId, from: selfPeerId }
      const envelope: CallSignalEnvelope = { type: CALL_SIGNAL_WRAPPER, app: CALL_SIGNAL_APP_ID, payload }

      try {
        await libp2p.services.pubsub.publish(
          CALL_SIGNAL_TOPIC,
          uint8ArrayFromString(encodeZeroWidth(JSON.stringify(envelope))),
        )
      } catch (e) {
        log.error('failed to publish call signal %o', e)
      }
    },
    [callId, libp2p.services.pubsub, selfPeerId],
  )

  const updateParticipant = useCallback((peerId: string, updates: Partial<CallParticipant>) => {
    setParticipantsMap((prev) => {
      const current = prev[peerId]
      const next: CallParticipant = {
        peerId,
        status: updates.status ?? current?.status ?? 'waiting',
        lastSeen: updates.lastSeen ?? Date.now(),
      }

      return { ...prev, [peerId]: next }
    })
  }, [])

  const removeParticipant = useCallback((peerId: string) => {
    setParticipantsMap((prev) => {
      if (!prev[peerId]) return prev
      const next = { ...prev }

      delete next[peerId]

      return next
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const setPaymentRate = useCallback(
    (rate: number) => {
      if (!isHost) {
        return
      }

      const normalized = Number.isFinite(rate) ? Math.max(0, Number(rate)) : 0

      setPaymentRateState(normalized)
      publishSignal({ action: 'payment-rate', payload: { ratePerMinute: normalized } }).catch(() => undefined)
    },
    [isHost, publishSignal],
  )

  const ensureLocalStream = useCallback(
    async (needsVideo: boolean, needsAudio: boolean) => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('Media devices are not available in this browser.')
      }

      if (localStreamRef.current) {
        const stream = localStreamRef.current
        const hasVideo = stream.getVideoTracks().length > 0
        const hasAudio = stream.getAudioTracks().length > 0

        if (needsVideo && !hasVideo) {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })

          videoStream.getVideoTracks().forEach((track) => stream.addTrack(track))
        }

        if (needsAudio && !hasAudio) {
          const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })

          audioStream.getAudioTracks().forEach((track) => stream.addTrack(track))
        }

        setLocalStream(new MediaStream(stream.getTracks()))

        return stream
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: needsVideo,
        audio: needsAudio,
      })

      localStreamRef.current = stream
      setLocalStream(stream)

      return stream
    },
    [setLocalStream],
  )

  const syncTrackState = useCallback(
    (stream: MediaStream) => {
      const videoEnabled = isScreenSharing ? true : isCameraEnabled

      stream.getVideoTracks().forEach((track) => {
        track.enabled = videoEnabled
      })
      stream.getAudioTracks().forEach((track) => {
        track.enabled = isMicEnabled
      })
    },
    [isCameraEnabled, isMicEnabled, isScreenSharing],
  )

  const attachTracksToConnection = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream)
    })
  }, [])

  const createPeerConnection = useCallback(
    (targetPeerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      peerConnectionRef.current = pc

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          publishSignal({
            action: 'call-ice',
            to: targetPeerId,
            payload: { candidate: event.candidate.toJSON() },
          })
        }
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams

        setRemoteStream(stream ?? null)
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState

        if (state === 'connected') {
          setStatus('in-call')
        }
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          setStatus('waiting')
          setRemoteStream(null)
          peerConnectionRef.current = null
        }
      }

      return pc
    },
    [publishSignal],
  )

  const closeConnection = useCallback(() => {
    const pc = peerConnectionRef.current

    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.close()
    }
    peerConnectionRef.current = null
    setRemoteStream(null)
  }, [])

  const endCall = useCallback(async () => {
    if (activePeerId) {
      await publishSignal({ action: 'call-end', to: activePeerId })
    }
    closeConnection()
    setActivePeerId(null)
    setStatus('waiting')
  }, [activePeerId, closeConnection, publishSignal])

  const startCallWith = useCallback(
    async (peerId: string) => {
      if (!isHost) {
        return
      }

      if (status === 'calling' || status === 'in-call') {
        return
      }

      setActivePeerId(peerId)
      setStatus('calling')
      updateParticipant(peerId, { status: 'ringing' })

      try {
        const stream = await ensureLocalStream(true, true)

        syncTrackState(stream)

        const pc = createPeerConnection(peerId)

        attachTracksToConnection(pc, stream)

        const offer = await pc.createOffer()

        await pc.setLocalDescription(offer)

        await publishSignal({
          action: 'call-offer',
          to: peerId,
          payload: { sdp: offer.sdp },
        })
      } catch (e: any) {
        log.error('failed to start call %o', e)
        setError(e?.message ?? 'Failed to start call.')
        setStatus('error')
      }
    },
    [
      attachTracksToConnection,
      createPeerConnection,
      ensureLocalStream,
      isHost,
      publishSignal,
      status,
      syncTrackState,
      updateParticipant,
    ],
  )

  const toggleCamera = useCallback(async () => {
    const next = !isCameraEnabled

    setIsCameraEnabled(next)

    if (!next) {
      localStreamRef.current?.getVideoTracks().forEach((track) => (track.enabled = false))

      return
    }

    const stream = await ensureLocalStream(true, isMicEnabled)

    stream.getVideoTracks().forEach((track) => (track.enabled = true))
  }, [ensureLocalStream, isCameraEnabled, isMicEnabled])

  const toggleMicrophone = useCallback(async () => {
    const next = !isMicEnabled

    setIsMicEnabled(next)

    if (!next) {
      localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = false))

      return
    }

    const stream = await ensureLocalStream(isCameraEnabled, true)

    stream.getAudioTracks().forEach((track) => (track.enabled = true))
  }, [ensureLocalStream, isCameraEnabled, isMicEnabled])

  const toggleScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('This browser does not support screen sharing.')

      return
    }

    if (!localStreamRef.current) {
      await ensureLocalStream(true, isMicEnabled)
    }

    if (!localStreamRef.current) {
      return
    }

    if (isScreenSharing) {
      // Restore camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      const newTrack = stream.getVideoTracks()[0]
      const oldTrack = localStreamRef.current.getVideoTracks()[0]

      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack)
        oldTrack.stop()
      }
      localStreamRef.current.addTrack(newTrack)
      localStreamRef.current.getVideoTracks().forEach((track) => (track.enabled = isCameraEnabled))
      peerConnectionRef.current?.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'video') {
          sender.replaceTrack(newTrack).catch(() => undefined)
        }
      })
      setIsScreenSharing(false)
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()))

      return
    }

    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const screenTrack = displayStream.getVideoTracks()[0]
    const oldTrack = localStreamRef.current.getVideoTracks()[0]

    if (oldTrack) {
      localStreamRef.current.removeTrack(oldTrack)
      oldTrack.stop()
    }
    localStreamRef.current.addTrack(screenTrack)

    screenTrack.onended = () => {
      setIsScreenSharing(false)
    }

    peerConnectionRef.current?.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'video') {
        sender.replaceTrack(screenTrack).catch(() => undefined)
      }
    })

    setIsScreenSharing(true)
    setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
  }, [ensureLocalStream, isCameraEnabled, isMicEnabled, isScreenSharing])

  const handleIncomingOffer = useCallback(
    async (signal: CallSignalMessage, peerId: string) => {
      if (isHost) {
        return
      }

      if (activePeerId && activePeerId !== peerId) {
        await publishSignal({ action: 'call-decline', to: peerId, payload: { reason: 'busy' } })

        return
      }

      setActivePeerId(peerId)
      setStatus('connecting')
      updateParticipant(peerId, { status: 'calling' })

      try {
        const stream = await ensureLocalStream(true, true)

        syncTrackState(stream)

        const pc = createPeerConnection(peerId)

        attachTracksToConnection(pc, stream)

        await pc.setRemoteDescription({ type: 'offer', sdp: signal.payload?.sdp })
        const answer = await pc.createAnswer()

        await pc.setLocalDescription(answer)

        await publishSignal({
          action: 'call-answer',
          to: peerId,
          payload: { sdp: answer.sdp },
        })
      } catch (e: any) {
        log.error('failed to answer call %o', e)
        setError(e?.message ?? 'Failed to answer call.')
        setStatus('error')
      }
    },
    [
      activePeerId,
      attachTracksToConnection,
      createPeerConnection,
      ensureLocalStream,
      isHost,
      publishSignal,
      syncTrackState,
      updateParticipant,
    ],
  )

  const handleIncomingAnswer = useCallback(async (signal: CallSignalMessage) => {
    const pc = peerConnectionRef.current

    if (!pc) return
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: signal.payload?.sdp })
      setStatus('in-call')
    } catch (e: any) {
      log.error('failed to apply answer %o', e)
      setError(e?.message ?? 'Failed to connect call.')
      setStatus('error')
    }
  }, [])

  const handleIncomingIce = useCallback(async (signal: CallSignalMessage) => {
    const pc = peerConnectionRef.current

    if (!pc) return
    const candidate = signal.payload?.candidate ?? null

    if (!candidate) return
    try {
      await pc.addIceCandidate(candidate)
    } catch (e) {
      log.error('failed to add ice candidate %o', e)
    }
  }, [])

  const handleSignal = useCallback(
    async (evt: CustomEvent<Message>) => {
      if (evt.detail.topic !== CALL_SIGNAL_TOPIC) return
      if (evt.detail.type !== 'signed') return

      let parsed: CallSignalMessage

      try {
        const decoded = decodeZeroWidth(uint8ArrayToString(evt.detail.data)) ?? uint8ArrayToString(evt.detail.data)
        const envelope = JSON.parse(decoded) as CallSignalEnvelope

        if (envelope?.type !== CALL_SIGNAL_WRAPPER || envelope?.app !== CALL_SIGNAL_APP_ID || !envelope.payload) {
          return
        }
        parsed = envelope.payload
      } catch {
        return
      }

      if (parsed.callId !== hostPeerId) return
      const incomingPeerId = evt.detail.from?.toString()

      if (parsed.action === 'presence-join') {
        if (incomingPeerId && incomingPeerId !== selfPeerId) {
          updateParticipant(incomingPeerId, { status: parsed.payload?.status ?? 'waiting', lastSeen: Date.now() })
        }
        if (isHost && typeof paymentRate === 'number') {
          publishSignal({ action: 'payment-rate', payload: { ratePerMinute: paymentRate } }).catch(() => undefined)
        }

        return
      }

      if (parsed.action === 'presence-leave') {
        if (incomingPeerId) {
          removeParticipant(incomingPeerId)
        }

        return
      }

      if (parsed.action === 'host-status') {
        if (!isHost) {
          setHostStatus(parsed.payload?.status ?? 'available')
        }

        return
      }

      if (parsed.action === 'payment-rate') {
        if (!isHost && typeof parsed.payload?.ratePerMinute === 'number') {
          setPaymentRateState(parsed.payload.ratePerMinute)
        }

        return
      }

      if (parsed.to && parsed.to !== selfPeerId) {
        return
      }

      switch (parsed.action) {
        case 'call-offer':
          if (!incomingPeerId) return
          await handleIncomingOffer(parsed, incomingPeerId)
          break
        case 'call-answer':
          await handleIncomingAnswer(parsed)
          break
        case 'call-ice':
          await handleIncomingIce(parsed)
          break
        case 'call-end':
          closeConnection()
          setStatus('waiting')
          setActivePeerId(null)
          break
        case 'call-decline':
          if (parsed.payload?.reason === 'busy') {
            setError('Peer is busy.')
          }
          closeConnection()
          setStatus('waiting')
          setActivePeerId(null)
          break
        default:
          break
      }
    },
    [
      closeConnection,
      handleIncomingAnswer,
      handleIncomingIce,
      handleIncomingOffer,
      hostPeerId,
      isHost,
      paymentRate,
      publishSignal,
      removeParticipant,
      selfPeerId,
      updateParticipant,
    ],
  )

  useEffect(() => {
    libp2p.services.pubsub.addEventListener('message', handleSignal)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', handleSignal)
    }
  }, [handleSignal, libp2p.services.pubsub])

  useEffect(() => {
    if (!selfPeerId) return
    publishSignal({ action: 'presence-join', payload: { status: 'waiting' } }).catch(() => undefined)

    return () => {
      publishSignal({ action: 'presence-leave' }).catch(() => undefined)
    }
  }, [publishSignal, selfPeerId])

  useEffect(() => {
    if (!isHost) return
    const nextHostStatus: HostStatus =
      status === 'calling' || status === 'in-call' || status === 'connecting' ? 'busy' : 'available'

    setHostStatus(nextHostStatus)
    publishSignal({ action: 'host-status', payload: { status: nextHostStatus } }).catch(() => undefined)
  }, [isHost, publishSignal, status])

  useEffect(() => {
    if (!localStreamRef.current) return
    syncTrackState(localStreamRef.current)
  }, [syncTrackState])

  useEffect(() => {
    if (!activePeerId || !isHost) {
      return
    }

    if (status === 'calling' || status === 'connecting') {
      updateParticipant(activePeerId, { status: 'ringing' })
    } else if (status === 'in-call') {
      updateParticipant(activePeerId, { status: 'in-call' })
    } else if (status === 'waiting') {
      updateParticipant(activePeerId, { status: 'waiting' })
    }
  }, [activePeerId, isHost, status, updateParticipant])

  useEffect(() => {
    return () => {
      closeConnection()
      localStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [closeConnection])

  const participants = useMemo(
    () => Object.values(participantsMap).filter((p) => p.peerId !== selfPeerId),
    [participantsMap, selfPeerId],
  )

  const value: CallContextValue = {
    callId,
    hostPeerId,
    selfPeerId,
    isHost,
    status,
    hostStatus,
    participants,
    activePeerId,
    error,
    localStream,
    remoteStream,
    isCameraEnabled,
    isMicEnabled,
    isScreenSharing,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    startCallWith,
    endCall,
    clearError,
    paymentRate,
    setPaymentRate,
  }

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>
}

export function useCallContext() {
  const ctx = useContext(CallContext)

  if (!ctx) {
    throw new Error('useCallContext must be used within a CallProvider')
  }

  return ctx
}
