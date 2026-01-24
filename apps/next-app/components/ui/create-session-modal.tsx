'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  Textarea,
} from '@heroui/react'
import { Camera, Mic, Sparkles, Users, Video, FileText, Plug, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react'

import { useCreateSessionModal } from '@/context/create-session-ctx'

const buildRoomUrl = (kind: string, roomId: string) => {
  if (kind === 'stream') return `/stream/${roomId}`
  if (kind === 'ai') return `/agent/${roomId}`
  if (kind === 'call') return `/call/${roomId}`

  return `/chat`
}

export function CreateSessionModal() {
  const router = useRouter()
  const { isOpen, isPublishing, draft, lastCreated, close, updateDraft, publish, resetDraft, clearLastCreated } =
    useCreateSessionModal()
  const [isCheckingDevices, setIsCheckingDevices] = useState(false)
  const [deviceCheckResult, setDeviceCheckResult] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewRef = useRef<HTMLVideoElement | null>(null)

  const normalizedAgentBaseUrl = useMemo(() => {
    const trimmed = draft.agentBaseUrl.trim()

    return trimmed ? trimmed.replace(/\/+$/, '') : ''
  }, [draft.agentBaseUrl])

  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((track) => track.stop())
    }
    setPreviewStream(null)
  }

  const startPreview = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPreviewError('Media devices unavailable in this browser.')
      return false
    }

    if (!draft.streamCamera && !draft.streamMic) {
      setPreviewError('Enable camera or microphone to preview.')
      return false
    }

    setPreviewError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: draft.streamCamera,
        audio: draft.streamMic,
      })

      setPreviewStream(stream)
      setPreviewError(null)
      return true
    } catch (error) {
      setPreviewError('Unable to access devices. Check permissions.')
      return false
    }
  }

  useEffect(() => {
    if (!previewRef.current) {
      return
    }

    if (previewStream) {
      previewRef.current.srcObject = previewStream
      previewRef.current.muted = true
      previewRef.current.play().catch(() => {})
    } else {
      previewRef.current.srcObject = null
    }
  }, [previewStream])

  useEffect(() => {
    if (!previewStream) {
      return
    }

    stopPreview()
    startPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.streamCamera, draft.streamMic])

  useEffect(() => {
    if (!isOpen) {
      stopPreview()
      setAiStatus('idle')
      setAiStatusMessage(null)
    }
  }, [isOpen])

  const handleDeviceCheck = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setDeviceCheckResult('Media devices unavailable in this browser.')
      return
    }

    setIsCheckingDevices(true)
    setDeviceCheckResult(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: draft.streamCamera,
        audio: draft.streamMic,
      })

      stream.getTracks().forEach((track) => track.stop())
      setDeviceCheckResult('Devices ready. You can go live anytime.')
    } catch (error) {
      setDeviceCheckResult('Unable to access devices. Check permissions.')
    } finally {
      setIsCheckingDevices(false)
    }
  }

  const connectAIProvider = async (): Promise<boolean> => {
    if (!normalizedAgentBaseUrl) {
      setAiStatus('error')
      setAiStatusMessage('Agent API URL is required.')
      return false
    }

    setAiStatus('connecting')
    setAiStatusMessage(null)

    try {
      if (draft.provider === 'openai') {
        if (!draft.openAIKey.trim()) {
          setAiStatus('error')
          setAiStatusMessage('OpenAI key is required.')
          return false
        }

        const keyResponse = await fetch(`${normalizedAgentBaseUrl}/openai/key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: draft.openAIKey.trim() }),
        })

        if (!keyResponse.ok) {
          const payload = await keyResponse.json().catch(() => ({}))
          throw new Error(payload?.error ?? 'Failed to save OpenAI key')
        }

        const modelResponse = await fetch(`${normalizedAgentBaseUrl}/openai/models`, { cache: 'no-store' })

        if (!modelResponse.ok) {
          const payload = await modelResponse.json().catch(() => ({}))
          throw new Error(payload?.error ?? 'OpenAI connection failed')
        }
      } else {
        const target = draft.lmStudioUrl.trim()
        const query = target ? `?target=${encodeURIComponent(target)}` : ''
        const modelResponse = await fetch(`${normalizedAgentBaseUrl}/v1/models${query}`, { cache: 'no-store' })

        if (!modelResponse.ok) {
          const payload = await modelResponse.json().catch(() => ({}))
          throw new Error(payload?.error ?? 'LM Studio connection failed')
        }
      }

      setAiStatus('connected')
      setAiStatusMessage('Connected and ready.')
      return true
    } catch (error: any) {
      setAiStatus('error')
      setAiStatusMessage(error?.message ?? 'Connection failed.')
      return false
    }
  }

  const persistSetup = (created: { kind: string; roomId: string; hostPeerId: string }) => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const payload = {
        createdAt: Date.now(),
        kind: created.kind,
        roomId: created.roomId,
        hostPeerId: created.hostPeerId,
        draft: {
          provider: draft.provider,
          modelId: draft.modelId,
          agentBaseUrl: draft.agentBaseUrl,
          lmStudioUrl: draft.lmStudioUrl,
          openAIKey: draft.openAIKey,
          streamCamera: draft.streamCamera,
          streamMic: draft.streamMic,
        },
      }

      sessionStorage.setItem('meetred:create-session', JSON.stringify(payload))
    } catch {
      // ignore persistence errors
    }
  }

  const handleLaunch = async () => {
    if (draft.kind === 'ai') {
      const connected = await connectAIProvider()

      if (!connected) {
        return
      }
    }

    if (draft.kind === 'stream') {
      const needsPreview = draft.streamCamera || draft.streamMic
      if (needsPreview && !previewStream) {
        const ok = await startPreview()

        if (!ok) {
          return
        }
      }
    }

    const created = await publish()

    if (created) {
      persistSetup(created)
      close()
      router.push(buildRoomUrl(created.kind, created.roomId))
    }
  }

  return (
    <Modal
      backdrop="opaque"
      disableAnimation
      isOpen={isOpen}
      isDismissable={false}
      placement="center"
      size="5xl"
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <ModalContent className="bg-[#0c1018] min-h-[85vh] text-white mx-4 my-4 max-w-6xl">
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Create session</span>
          <span className="text-xl font-semibold">Set up and launch your room</span>
        </ModalHeader>
        <ModalBody className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="rounded-2xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Session type</p>
              <div className="mt-3 grid gap-2">
                <Button
                  className={draft.kind === 'stream' ? 'bg-sky-500 text-white' : 'border border-white/15 text-white/70'}
                  size="sm"
                  startContent={<Video size={14} />}
                  variant={draft.kind === 'stream' ? 'solid' : 'bordered'}
                  onPress={() => updateDraft({ kind: 'stream' })}
                >
                  Live stream
                </Button>
                <Button
                  className={draft.kind === 'ai' ? 'bg-emerald-500 text-white' : 'border border-white/15 text-white/70'}
                  size="sm"
                  startContent={<Sparkles size={14} />}
                  variant={draft.kind === 'ai' ? 'solid' : 'bordered'}
                  onPress={() => updateDraft({ kind: 'ai' })}
                >
                  AI room
                </Button>
                <Button
                  className={draft.kind === 'call' ? 'bg-amber-500 text-white' : 'border border-white/15 text-white/70'}
                  size="sm"
                  startContent={<Users size={14} />}
                  variant={draft.kind === 'call' ? 'solid' : 'bordered'}
                  onPress={() => updateDraft({ kind: 'call' })}
                >
                  Private call
                </Button>
                <Button
                  className={
                    draft.kind === 'file' ? 'bg-fuchsia-500 text-white' : 'border border-white/15 text-white/70'
                  }
                  size="sm"
                  startContent={<FileText size={14} />}
                  variant={draft.kind === 'file' ? 'solid' : 'bordered'}
                  onPress={() => updateDraft({ kind: 'file' })}
                >
                  File share
                </Button>
              </div>
              <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/60">
                <p className="uppercase tracking-[0.3em] text-white/40">Continuity</p>
                <p className="mt-2">You can close this modal and resume setup later.</p>
              </div>
            </div>

            <div className="space-y-5">
              {draft.kind === 'ai' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Connect a model</p>
                      <p className="text-xs text-white/60">Choose your provider and model before launch.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                      <Plug className="h-3.5 w-3.5" />
                      Provider
                    </div>
                  </div>
                  <Tabs
                    aria-label="AI provider"
                    selectedKey={draft.provider}
                    onSelectionChange={(key) => updateDraft({ provider: key === 'openai' ? 'openai' : 'lmstudio' })}
                  >
                    <Tab key="lmstudio" title="LM Studio" />
                    <Tab key="openai" title="OpenAI" />
                  </Tabs>
                  <Input
                    classNames={{
                      inputWrapper: 'bg-black/40 border border-white/10',
                      input: 'text-white/80',
                    }}
                    label="Agent API URL"
                    labelPlacement="outside"
                    placeholder="http://127.0.0.1:4312"
                    value={draft.agentBaseUrl}
                    onChange={(event) => updateDraft({ agentBaseUrl: event.target.value })}
                  />
                  {draft.provider === 'lmstudio' ? (
                    <Input
                      classNames={{
                        inputWrapper: 'bg-black/40 border border-white/10',
                        input: 'text-white/80',
                      }}
                      label="LM Studio target URL"
                      labelPlacement="outside"
                      placeholder="http://127.0.0.1:1234/v1"
                      value={draft.lmStudioUrl}
                      onChange={(event) => updateDraft({ lmStudioUrl: event.target.value })}
                    />
                  ) : (
                    <Input
                      classNames={{
                        inputWrapper: 'bg-black/40 border border-white/10',
                        input: 'text-white/80',
                      }}
                      label="OpenAI key"
                      labelPlacement="outside"
                      placeholder="sk-..."
                      type="password"
                      value={draft.openAIKey}
                      onChange={(event) => updateDraft({ openAIKey: event.target.value })}
                    />
                  )}
                  <Input
                    classNames={{
                      inputWrapper: 'bg-black/40 border border-white/10',
                      input: 'text-white/80',
                    }}
                    label="Model ID"
                    labelPlacement="outside"
                    placeholder="gpt-4o-mini"
                    value={draft.modelId}
                    onChange={(event) => updateDraft({ modelId: event.target.value })}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      className="border border-white/15 text-white/80"
                      isLoading={aiStatus === 'connecting'}
                      size="sm"
                      variant="bordered"
                      onPress={connectAIProvider}
                    >
                      {aiStatus === 'connected' ? 'Re-check' : 'Connect'}
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      {aiStatus === 'connected' ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>{aiStatusMessage ?? 'Connected'}</span>
                        </>
                      ) : aiStatus === 'error' ? (
                        <>
                          <XCircle className="h-4 w-4 text-rose-400" />
                          <span>{aiStatusMessage ?? 'Connection failed'}</span>
                        </>
                      ) : (
                        <span>{aiStatusMessage ?? 'Not connected yet'}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {draft.kind === 'stream' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Media devices</p>
                      <p className="text-xs text-white/60">Confirm camera and mic before you go live.</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Pre-flight
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      className={draft.streamCamera ? 'bg-white text-black' : 'border border-white/15 text-white/70'}
                      size="sm"
                      startContent={<Camera size={14} />}
                      variant={draft.streamCamera ? 'solid' : 'bordered'}
                      onPress={() => updateDraft({ streamCamera: !draft.streamCamera })}
                    >
                      Camera {draft.streamCamera ? 'on' : 'off'}
                    </Button>
                    <Button
                      className={draft.streamMic ? 'bg-white text-black' : 'border border-white/15 text-white/70'}
                      size="sm"
                      startContent={<Mic size={14} />}
                      variant={draft.streamMic ? 'solid' : 'bordered'}
                      onPress={() => updateDraft({ streamMic: !draft.streamMic })}
                    >
                      Microphone {draft.streamMic ? 'on' : 'off'}
                    </Button>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60">
                    {previewStream ? (
                      <video ref={previewRef} autoPlay playsInline className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 flex-col items-center justify-center gap-2 text-xs text-white/60">
                        <p>No preview yet.</p>
                        <p>Start preview to confirm your camera and mic.</p>
                      </div>
                    )}
                  </div>
                  {previewError ? <p className="text-xs text-rose-300">{previewError}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="border border-white/15 text-white/80"
                      size="sm"
                      variant="bordered"
                      onPress={previewStream ? stopPreview : startPreview}
                    >
                      {previewStream ? 'Stop preview' : 'Start preview'}
                    </Button>
                    <Button
                      className="border border-white/15 text-white/80"
                      isLoading={isCheckingDevices}
                      size="sm"
                      variant="bordered"
                      onPress={handleDeviceCheck}
                    >
                      Check devices
                    </Button>
                    {deviceCheckResult ? <span className="text-xs text-white/60">{deviceCheckResult}</span> : null}
                  </div>
                </div>
              )}

              {draft.kind === 'call' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Call setup</p>
                    <p className="text-xs text-white/60">Private calls stay invite-only by default.</p>
                  </div>
                  <RadioGroup
                    value={draft.callVisibility}
                    onValueChange={(value) =>
                      updateDraft({ callVisibility: value === 'public' ? 'public' : 'private' })
                    }
                  >
                    <Radio value="private">Private (invite only)</Radio>
                    <Radio value="public">Public (discoverable)</Radio>
                  </RadioGroup>
                </div>
              )}

              {draft.kind === 'file' && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-white">File share details</p>
                    <p className="text-xs text-white/60">Give the file drop a short label.</p>
                  </div>
                  <Input
                    classNames={{
                      inputWrapper: 'bg-black/40 border border-white/10',
                      input: 'text-white/80',
                    }}
                    label="Label (optional)"
                    labelPlacement="outside"
                    placeholder="Design assets"
                    value={draft.fileLabel}
                    onChange={(event) => updateDraft({ fileLabel: event.target.value })}
                  />
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Post note</p>
                <Textarea
                  classNames={{
                    inputWrapper: 'bg-black/40 border border-white/10',
                    input: 'text-white/90 text-[15px] leading-relaxed',
                  }}
                  maxLength={500}
                  minRows={3}
                  placeholder="Add a short public note for this session..."
                  value={draft.note}
                  variant="flat"
                  onChange={(event) => updateDraft({ note: event.target.value })}
                />
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="flat" onPress={close}>
              Continue later
            </Button>
            <Button variant="light" onPress={() => resetDraft()}>
              Reset
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {lastCreated ? (
              <Button variant="light" onPress={clearLastCreated}>
                New session
              </Button>
            ) : null}
            <Button
              className="rounded-full bg-white text-xs font-semibold uppercase tracking-[0.2em] text-black"
              isDisabled={isPublishing}
              onPress={handleLaunch}
            >
              {isPublishing ? 'Publishing...' : 'Go live'}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
