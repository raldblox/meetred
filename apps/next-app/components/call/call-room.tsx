'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Blockies from 'react-18-blockies'
import { Button, Chip, Input, useDisclosure } from '@heroui/react'
import { Camera, CameraOff, Mic, MicOff, PhoneOff, ScreenShare, Share2 } from 'lucide-react'

import { ShareRoomModal } from '@/components/ui/share-room-modal'
import { useCallContext } from '@/context/call-ctx'
import { PAY_PER_MINUTE_CONFIG } from '@/config/payments'
import { PayPerMinuteChip } from '@/components/payments/pay-per-minute-chip'
import { PayPerMinuteModal } from '@/components/payments/pay-per-minute-modal'
import { usePayPerMinute } from '@/hooks/usePayPerMinute'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useLibp2pContext } from '@/context/libp2p-ctx'

const ringPositions = [
  { x: 0, y: -120 },
  { x: 100, y: -80 },
  { x: 140, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 120 },
  { x: -100, y: 80 },
  { x: -140, y: 0 },
  { x: -100, y: -80 },
]

export function CallRoom({ callId }: { callId: string }) {
  const { libp2p } = useLibp2pContext()
  const {
    isHost,
    hostPeerId,
    selfPeerId,
    participants,
    activePeerId,
    status,
    hostStatus,
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
    error,
    paymentRate,
    setPaymentRate,
  } = useCallContext()
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localPreviewRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

  const { isOpen: isShareModalOpen, onOpen: openShareModal, onOpenChange: onShareModalOpenChange } = useDisclosure()

  const sessionTimer = useSessionTimer()
  const sessionActive = status === 'in-call'
  const paymentPromptActive = !isHost && (status === 'calling' || status === 'connecting' || status === 'in-call')
  const [rateDraft, setRateDraft] = useState(() => PAY_PER_MINUTE_CONFIG.call.ratePerMinute.toString())
  const effectiveRate = isHost ? (paymentRate ?? PAY_PER_MINUTE_CONFIG.call.ratePerMinute) : paymentRate
  const paymentGate = usePayPerMinute({
    config: PAY_PER_MINUTE_CONFIG.call,
    elapsedMs: sessionTimer.elapsedMs,
    sessionActive: paymentPromptActive,
    ratePerMinute: effectiveRate,
    requireRateAcceptance: !isHost,
    autoPrompt: !isHost,
    analytics: {
      libp2p,
      peerId: selfPeerId ?? 'unknown',
      roomId: callId,
      roomType: 'call',
    },
  })
  const allowSessionStart = isHost ? true : paymentGate.isReady
  const paymentBadgeLabel = paymentGate.isReady
    ? `${isHost ? 'Earned' : 'Paid'} ${paymentGate.badgeLabel}`
    : isHost
      ? 'Set payout'
      : paymentGate.badgeLabel
  const payoutLabel = paymentGate.payoutAddress.trim() ? 'Payout set' : 'Set payout'
  const needsPayout = isHost && !paymentGate.isFree && !paymentGate.payoutAddress.trim()

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null
    }
    if (localPreviewRef.current) {
      localPreviewRef.current.srcObject = localStream ?? null
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream ?? null
    }
  }, [remoteStream])

  useEffect(() => {
    if (!isHost) {
      return
    }

    if (paymentRate === null) {
      setPaymentRate(PAY_PER_MINUTE_CONFIG.call.ratePerMinute)
    }
  }, [isHost, paymentRate, setPaymentRate])

  useEffect(() => {
    if (!isHost) {
      return
    }

    if (typeof paymentRate === 'number') {
      setRateDraft(paymentRate.toFixed(2))
    }
  }, [isHost, paymentRate])

  useEffect(() => {
    const shouldRun = allowSessionStart && sessionActive

    if (shouldRun && !sessionTimer.isRunning) {
      sessionTimer.reset()
      sessionTimer.start()
    } else if (!shouldRun && sessionTimer.isRunning) {
      sessionTimer.stop()
    }
  }, [allowSessionStart, sessionTimer, status])

  const shareableLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.origin)

    url.pathname = `/call/${callId}`
    if (!url.searchParams.has('autoJoin')) {
      url.searchParams.set('autoJoin', 'true')
    }

    return url.toString()
  }, [callId])

  const hostPresent = participants.some((peer) => peer.peerId === hostPeerId)
  const visiblePeers = participants.filter((peer) => peer.peerId !== hostPeerId)
  const activePeer = participants.find((peer) => peer.peerId === activePeerId)
  const hostShortId = hostPeerId.slice(-7)
  const statusMessage = isHost
    ? visiblePeers.length === 0
      ? 'Share your call link and wait for someone to join.'
      : status === 'calling'
        ? `Calling ${activePeer?.peerId.slice(-7) ?? 'peer'}...`
        : status === 'in-call'
          ? `In call with ${activePeer?.peerId.slice(-7) ?? 'peer'}`
          : 'Select a peer to start a private call.'
    : !hostPresent
      ? 'Host has not joined the room yet.'
      : hostStatus === 'busy'
        ? 'Host is currently in another call.'
        : status === 'connecting'
          ? 'Host is connecting the call...'
          : 'Waiting for the host to pick a peer.'

  const showCallStage = status === 'calling' || status === 'connecting' || status === 'in-call'

  return (
    <div className="flex flex-col h-full">
      <header className="flex h-12 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-default-800">
            Private call <span className="text-default-500">#{hostShortId}</span>
          </h1>
          <Chip className="font-mono" size="sm" variant="flat">
            {sessionTimer.formatted}
          </Chip>
          {isHost || !paymentGate.isFree ? (
            <PayPerMinuteChip
              isReady={paymentGate.isReady}
              label={isHost ? payoutLabel : paymentBadgeLabel}
              onPress={paymentGate.openModal}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            aria-label="Share call room"
            className="border border-default-200"
            radius="full"
            startContent={<Share2 className="h-4 w-4" />}
            variant="light"
            onPress={openShareModal}
          />
        </div>
      </header>

      <div className="flex-1 grid gap-6 lg:grid-cols-5 min-h-0">
        <section className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          <div className="rounded-3xl border border-default-100 bg-default-900/5 p-6 flex-1 min-h-[360px] flex items-center justify-center">
            {showCallStage ? (
              <div className="grid w-full h-full gap-4 md:grid-cols-2">
                <div className="relative rounded-2xl bg-default-50 overflow-hidden">
                  <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover">
                    <track kind="captions" />
                  </video>
                  {!isCameraEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center text-default-400">Camera off</div>
                  )}
                </div>
                <div className="relative rounded-2xl bg-default-50 overflow-hidden">
                  <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover">
                    <track kind="captions" />
                  </video>
                  {!remoteStream && (
                    <div className="absolute inset-0 flex items-center justify-center text-default-400">
                      Waiting for peer
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative flex items-center justify-center h-72 w-72">
                <div className="absolute h-40 w-40 rounded-full border border-dashed border-default-300" />
                <div className="absolute flex h-24 w-24 items-center justify-center rounded-full border border-default-200 bg-default-50 text-default-700">
                  <Blockies className="rounded-sm h-14" scale={12} seed={hostPeerId} size={6} />
                </div>
                {visiblePeers.map((peer, index) => {
                  const position = ringPositions[index % ringPositions.length]
                  const isBusy = peer.status === 'busy' || peer.status === 'in-call'
                  const isActive = peer.peerId === activePeerId
                  const disabled = !isHost || status === 'ringing' || status === 'waiting'

                  return (
                    <button
                      key={peer.peerId}
                      className={`absolute flex flex-col items-center gap-1 transition ${isActive ? 'scale-110' : ''}`}
                      disabled={disabled || isBusy}
                      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                      type="button"
                      onClick={() => {
                        if (needsPayout) {
                          paymentGate.openModal()

                          return
                        }

                        startCallWith(peer.peerId)
                      }}
                    >
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                          disabled ? 'border-default-200' : 'border-primary-200 bg-primary-50'
                        }`}
                      >
                        <Blockies className="rounded-sm h-8" scale={8} seed={peer.peerId} size={6} />
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-default-500">
                        {peer.peerId.slice(-7)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-default-100 bg-default-50 p-4">
            <p className="text-sm font-semibold text-default-700">{statusMessage}</p>
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
          </div>
        </section>

        <aside className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="rounded-2xl border border-default-100 bg-default-50 p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-default-700">Your setup</p>
              <p className="text-xs text-default-500">
                {selfPeerId ? `You are ${selfPeerId.slice(-7)}` : 'Connecting identity...'}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-default-100 aspect-video">
              <video ref={localPreviewRef} autoPlay muted playsInline className="h-full w-full object-cover">
                <track kind="captions" />
              </video>
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-default-400">
                  Enable your camera or mic to preview.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                isIconOnly
                aria-label="Toggle camera"
                color={isCameraEnabled ? 'success' : 'default'}
                radius="full"
                startContent={isCameraEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                variant="flat"
                onPress={toggleCamera}
              />
              <Button
                isIconOnly
                aria-label="Toggle microphone"
                color={isMicEnabled ? 'success' : 'default'}
                radius="full"
                startContent={isMicEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                variant="flat"
                onPress={toggleMicrophone}
              />
              <Button
                isIconOnly
                aria-label="Toggle screen share"
                color={isScreenSharing ? 'success' : 'default'}
                radius="full"
                startContent={<ScreenShare className="h-4 w-4" />}
                variant="flat"
                onPress={toggleScreenShare}
              />
              {status === 'in-call' && (
                <Button
                  isIconOnly
                  aria-label="End call"
                  color="danger"
                  radius="full"
                  startContent={<PhoneOff className="h-4 w-4" />}
                  variant="solid"
                  onPress={endCall}
                />
              )}
            </div>
            {isHost ? (
              <div className="rounded-xl border border-default-100 bg-white/60 p-3">
                <p className="text-[11px] uppercase tracking-[0.3em] text-default-400">Rate per minute</p>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    aria-label="Rate per minute"
                    className="flex-1"
                    placeholder="0.00"
                    size="sm"
                    value={rateDraft}
                    onChange={(event) => setRateDraft(event.target.value)}
                  />
                  <Button
                    color="primary"
                    size="sm"
                    variant="solid"
                    onPress={() => {
                      const next = Number.parseFloat(rateDraft)

                      if (Number.isFinite(next)) {
                        setPaymentRate(next)
                      }
                    }}
                  >
                    Update
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-default-500">Viewers must accept this rate before approving.</p>
                {needsPayout ? (
                  <p className="mt-2 text-[11px] text-danger">Add a payout address before starting calls.</p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-default-100 bg-white/60 p-3">
                <div className="flex items-center justify-between text-xs text-default-600">
                  <span>Rate</span>
                  <span className="font-mono">
                    {typeof paymentRate === 'number'
                      ? paymentRate === 0
                        ? 'FREE'
                        : `${paymentRate.toFixed(2)}/min`
                      : 'Waiting on host'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-default-600">
                  <span>Consent</span>
                  <span>
                    {paymentGate.isFree ? 'Not required' : paymentGate.rateAccepted ? 'Accepted' : 'Not accepted'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    color="primary"
                    radius="full"
                    size="sm"
                    onPress={() => {
                      paymentGate.resume()
                      if (!paymentGate.isFree) {
                        paymentGate.openModal()
                      }
                    }}
                  >
                    Start
                  </Button>
                  <Button
                    color="warning"
                    radius="full"
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      paymentGate.pause()
                      endCall()
                    }}
                  >
                    Pause
                  </Button>
                  <Button
                    color="danger"
                    radius="full"
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      paymentGate.reset()
                      endCall()
                    }}
                  >
                    Stop
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-default-100 bg-default-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-default-700">Waiting room</p>
            <div className="space-y-2">
              {visiblePeers.length === 0 ? (
                <p className="text-xs text-default-500">No peers yet. Share the link.</p>
              ) : (
                visiblePeers.map((peer) => (
                  <div key={peer.peerId} className="flex items-center justify-between rounded-lg bg-white/60 p-2">
                    <div className="flex items-center gap-2">
                      <Blockies className="rounded-sm h-6" scale={6} seed={peer.peerId} size={6} />
                      <span className="text-xs uppercase tracking-wide text-default-600">{peer.peerId.slice(-7)}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-default-400">{peer.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <ShareRoomModal
        showQrCode
        isOpen={isShareModalOpen}
        roomType="call"
        shareUrl={shareableLink}
        subtitle="Share the link to invite someone into your private call."
        title="Share call room"
        onOpenChange={onShareModalOpenChange}
      />
      {isHost || !paymentGate.isFree ? (
        <PayPerMinuteModal
          config={paymentGate.config}
          connection={paymentGate.connection}
          formattedAmount={paymentGate.formattedAmount}
          formattedRate={paymentGate.formattedRate}
          isOpen={paymentGate.modalOpen}
          mode={isHost ? 'host' : 'viewer'}
          payoutAddress={paymentGate.payoutAddress}
          rateAccepted={paymentGate.rateAccepted}
          rateAvailable={paymentGate.rateAvailable}
          requiresRateAcceptance={!isHost}
          status={paymentGate.status}
          statusLabel={paymentGate.statusLabel}
          onAcceptRate={paymentGate.acceptRate}
          onConnectCoinbase={paymentGate.connectCoinbase}
          onConnectWallet={paymentGate.connectWallet}
          onOpenChange={(open) => (open ? paymentGate.openModal() : paymentGate.closeModal())}
          onPayoutAddressChange={paymentGate.setPayoutAddress}
          onRequestApproval={paymentGate.requestApproval}
          onReset={paymentGate.reset}
        />
      ) : null}
    </div>
  )
}
