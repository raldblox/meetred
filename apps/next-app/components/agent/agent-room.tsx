'use client'

import type { Selection } from '@react-types/shared'
import type { AgentManagerState } from '@/lib/agent-manager'
import type { LMStudioModel } from '@/lib/lmstudio'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  ScrollShadow,
  Select,
  SelectItem,
  Tab,
  Tabs,
  useDisclosure,
} from '@heroui/react'
import { Share2 } from 'lucide-react'

import { useAgentContext } from '@/context/agent-ctx'
import { AgentChatPanel } from '@/components/agent/agent-chat-panel'
import { PayPerMinuteChip } from '@/components/payments/pay-per-minute-chip'
import { PayPerMinuteModal } from '@/components/payments/pay-per-minute-modal'
import { ShareRoomModal } from '@/components/ui/share-room-modal'
import { AI_ROOM_COPY } from '@/config/copy'
import { PAY_PER_MINUTE_CONFIG } from '@/config/payments'
import { usePayPerMinute } from '@/hooks/usePayPerMinute'
import { useSessionTimer } from '@/hooks/useSessionTimer'
import { useLibp2pContext } from '@/context/libp2p-ctx'

const statusColorMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'> = {
  idle: 'default',
  connecting: 'secondary',
  authorizing: 'secondary',
  'waiting-host': 'warning',
  ready: 'success',
  error: 'danger',
}

export function AgentRoom({ peerId }: { peerId: string }) {
  const { libp2p } = useLibp2pContext()
  const {
    isHost,
    hostPeerId,
    hostStatus,
    error,
    authorized,
    models,
    agentState,
    lmBaseUrl,
    setLmBaseUrl,
    lmTargetUrl,
    setLmTargetUrl,
    connectLocalAgent,
    connectOpenAIAgent,
    selectAgentModel,
    hostEvents,
    paymentRate,
    setPaymentRate,
    disconnectViewer,
    connectViewer,
  } = useAgentContext()
  const { isOpen: isShareModalOpen, onOpen: openShareModal, onOpenChange: onShareModalOpenChange } = useDisclosure()
  const sessionTimer = useSessionTimer()
  const lastTimerStateRef = useRef(false)
  const autoConnectRef = useRef(false)

  const activeModel = useMemo(
    () => models.find((model) => model.id === agentState.selectedModelId),
    [agentState.selectedModelId, models],
  )
  const chatTitle = authorized ? AI_ROOM_COPY.chatPanel.titleReady : AI_ROOM_COPY.chatPanel.titleWaiting
  const chatSubtitle = authorized ? AI_ROOM_COPY.chatPanel.subtitleReady : AI_ROOM_COPY.chatPanel.subtitleWaiting
  const modelStatus = authorized
    ? activeModel
      ? `Model - ${activeModel.id}`
      : AI_ROOM_COPY.setupPanel.local.statusWaiting
    : ''
  const shareTargetPeerId = hostPeerId || peerId || 'agent-room'
  const shareableLink = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(window.location.origin)

    url.pathname = `/agent/${shareTargetPeerId}`
    if (!url.searchParams.has('autoJoin')) {
      url.searchParams.set('autoJoin', 'true')
    }

    return url.toString()
  }, [shareTargetPeerId])

  const shareModal = (
    <ShareRoomModal
      showQrCode
      isOpen={isShareModalOpen}
      roomType="ai"
      shareUrl={shareableLink}
      subtitle="Share the AI room link or a pre-filled post."
      title="Share AI room"
      onOpenChange={onShareModalOpenChange}
    />
  )

  const modelReady = authorized && agentState.status === 'ready'
  const sessionActive = modelReady
  const paymentPromptActive = !isHost && authorized
  const [rateDraft, setRateDraft] = useState(() => PAY_PER_MINUTE_CONFIG.agent.ratePerMinute.toString())
  const effectiveRate = isHost ? (paymentRate ?? PAY_PER_MINUTE_CONFIG.agent.ratePerMinute) : paymentRate
  const paymentGate = usePayPerMinute({
    config: PAY_PER_MINUTE_CONFIG.agent,
    elapsedMs: sessionTimer.elapsedMs,
    sessionActive: paymentPromptActive,
    ratePerMinute: effectiveRate,
    requireRateAcceptance: !isHost,
    autoPrompt: !isHost,
    analytics: {
      libp2p,
      peerId: libp2p.peerId.toString(),
      roomId: shareTargetPeerId,
      roomType: 'ai',
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
    if (!isHost) {
      return
    }

    if (paymentRate === null) {
      setPaymentRate(PAY_PER_MINUTE_CONFIG.agent.ratePerMinute)
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

    if (shouldRun && !lastTimerStateRef.current) {
      sessionTimer.reset()
      sessionTimer.start()
      lastTimerStateRef.current = true
    } else if (!shouldRun && lastTimerStateRef.current) {
      sessionTimer.stop()
      lastTimerStateRef.current = false
    }
  }, [allowSessionStart, modelReady, sessionTimer])

  useEffect(() => {
    if (!isHost || authorized || autoConnectRef.current) {
      return
    }

    if (typeof window === 'undefined') {
      return
    }

    const raw = sessionStorage.getItem('meetred:create-session')

    if (!raw) {
      return
    }

    try {
      const payload = JSON.parse(raw)
      const selfPeerId = libp2p.peerId?.toString()

      if (payload?.kind !== 'ai' || !selfPeerId || payload.hostPeerId !== selfPeerId) {
        return
      }

      if (typeof payload.createdAt === 'number' && Date.now() - payload.createdAt > 10 * 60 * 1000) {
        sessionStorage.removeItem('meetred:create-session')
        return
      }

      autoConnectRef.current = true
      sessionStorage.removeItem('meetred:create-session')

      const draft = payload.draft ?? {}

      if (typeof draft.agentBaseUrl === 'string' && draft.agentBaseUrl.trim()) {
        setLmBaseUrl(draft.agentBaseUrl)
      }

      if (typeof draft.lmStudioUrl === 'string' && draft.lmStudioUrl.trim()) {
        setLmTargetUrl(draft.lmStudioUrl)
      }

      const provider = draft.provider === 'openai' ? 'openai' : 'lmstudio'
      const apiKey = provider === 'openai' ? String(draft.openAIKey ?? '') : ''

      setTimeout(async () => {
        try {
          if (provider === 'openai') {
            await connectOpenAIAgent(apiKey)
          } else {
            await connectLocalAgent()
          }

          if (typeof draft.modelId === 'string' && draft.modelId.trim()) {
            selectAgentModel(draft.modelId.trim())
          }
        } catch {
          autoConnectRef.current = false
        }
      }, 0)
    } catch {
      // ignore malformed payload
    }
  }, [
    authorized,
    connectLocalAgent,
    connectOpenAIAgent,
    isHost,
    libp2p.peerId,
    setLmBaseUrl,
    setLmTargetUrl,
    selectAgentModel,
  ])

  if (!isHost) {
    return (
      <>
        <div className="flex h-full min-h-0 mx-auto w-full flex-col gap-4 overflow-hidden">
          <Card className=" bg-transparent p-0 shadow-none h-full">
            <CardHeader className="flex px-0 items-start justify-between h-12 gap-3 pb-1">
              <h2 className="text-lg font-semibold text-default-900">Agent Room</h2>
              <div className="flex items-center gap-2">
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
                <Button
                  isIconOnly
                  aria-label="Share AI room"
                  radius="full"
                  size="sm"
                  startContent={<Share2 className="h-4 w-4" />}
                  variant="light"
                  onPress={openShareModal}
                />
              </div>
            </CardHeader>
            <CardBody className="grid md:grid-cols-6 p-0">
              <div className="col-start-2 col-span-4 space-y-3">
                <div className="rounded-2xl border border-default-100 bg-default-50 p-3 text-xs text-default-600">
                  <div className="flex items-center justify-between">
                    <span>Rate</span>
                    <span className="font-mono">
                      {typeof paymentRate === 'number'
                        ? paymentRate === 0
                          ? 'FREE'
                          : `${paymentRate.toFixed(2)}/min`
                        : 'Waiting on host'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
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
                        connectViewer()
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
                        disconnectViewer()
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
                        disconnectViewer()
                      }}
                    >
                      Stop
                    </Button>
                  </div>
                </div>
                <AgentChatPanel agentPeerId={hostPeerId} />
              </div>
            </CardBody>
          </Card>
        </div>
        {shareModal}
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
      </>
    )
  }

  return (
    <>
      <div className="flex h-full min-h-0 w-full flex-col gap-6 overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-6 h-full min-h-0">
          <div className="h-full min-h-0">
            <ActivityCard hostEvents={hostEvents} hostPeerId={hostPeerId} />
            {error ? <div className="text-sm text-danger">{error}</div> : null}
          </div>
          <Card className="bg-transparent md:col-span-4 gap-4 rounded-sm shadow-none h-full">
            <CardBody className="px-0 py-0 flex flex-col gap-3 h-full">
              <AgentChatPanel agentPeerId={hostPeerId} />
            </CardBody>
          </Card>

          <div className="flex flex-col gap-4 h-full min-h-0">
            <div className="ml-auto flex items-center gap-2">
              <Chip className="capitalize" color={statusColorMap[hostStatus] ?? 'default'} size="sm" variant="flat">
                {hostStatus}
              </Chip>
              <Chip className="font-mono" size="sm" variant="flat">
                {sessionTimer.formatted}
              </Chip>
              <PayPerMinuteChip
                isReady={paymentGate.isReady}
                label={paymentBadgeLabel}
                onPress={paymentGate.openModal}
              />
              <Button
                isIconOnly
                aria-label="Share AI room"
                radius="full"
                size="sm"
                startContent={<Share2 className="h-4 w-4" />}
                variant="light"
                onPress={openShareModal}
              />
            </div>
            <Card className="border border-default-200 shadow-none bg-default-50/70">
              <CardBody className="space-y-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-default-400">Rate per minute</p>
                  <p className="text-xs text-default-500">Viewers must accept before approving.</p>
                </div>
                <div className="flex items-center gap-2">
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
                {needsPayout ? (
                  <div className="flex items-center justify-between text-[11px] text-danger">
                    <span>Add a payout address before hosting.</span>
                    <Button color="danger" size="sm" variant="flat" onPress={paymentGate.openModal}>
                      Set payout
                    </Button>
                  </div>
                ) : null}
              </CardBody>
            </Card>
            <AgentManagerPanel
              agentState={agentState}
              authorized={authorized}
              connectLocalAgent={connectLocalAgent}
              connectOpenAIAgent={connectOpenAIAgent}
              isHost={isHost}
              lmBaseUrl={lmBaseUrl}
              lmTargetUrl={lmTargetUrl}
              models={models}
              selectAgentModel={selectAgentModel}
              setLmBaseUrl={setLmBaseUrl}
              setLmTargetUrl={setLmTargetUrl}
            />
          </div>
        </div>
      </div>
      {shareModal}
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
    </>
  )
}

interface AgentManagerPanelProps {
  isHost: boolean
  agentState: AgentManagerState
  models: LMStudioModel[]
  lmBaseUrl: string
  lmTargetUrl: string
  setLmBaseUrl: (url: string) => void
  setLmTargetUrl: (url: string) => void
  connectLocalAgent: () => Promise<void>
  connectOpenAIAgent: (apiKey: string) => Promise<void>
  selectAgentModel: (modelId: string | null) => void
  authorized: boolean
}

function AgentManagerPanel({
  isHost,
  agentState,
  models,
  lmBaseUrl,
  setLmBaseUrl,
  lmTargetUrl,
  setLmTargetUrl,
  connectLocalAgent,
  connectOpenAIAgent,
  selectAgentModel,
  authorized,
}: AgentManagerPanelProps) {
  const [providerSelection, setProviderSelection] = useState<'lmstudio-local' | 'openai'>('lmstudio-local')
  const [openAIKey, setOpenAIKey] = useState('')
  const [editingOpenAIKey, setEditingOpenAIKey] = useState(true)

  useEffect(() => {
    if (agentState.sourceType === 'openai' || agentState.sourceType === 'lmstudio-local') {
      setProviderSelection(agentState.sourceType)
    }

    if (agentState.sourceType === 'openai' && agentState.status === 'ready') {
      setEditingOpenAIKey(false)
    }
  }, [agentState.sourceType, agentState.status])

  const provider = providerSelection

  const handleProviderChange = useCallback((key: React.Key) => {
    const next = key === 'openai' ? 'openai' : 'lmstudio-local'

    setProviderSelection(next)

    if (next === 'openai') {
      setEditingOpenAIKey(true)
    }
  }, [])

  const handleModelSelection = useCallback(
    (keys: Selection) => {
      const first = Array.from(keys)[0]

      if (typeof first === 'string') {
        selectAgentModel(first)
      }
    },
    [selectAgentModel],
  )

  const formatModelDetails = useCallback((model: LMStudioModel) => {
    if (model.description) {
      return model.description
    }

    if (typeof model.created === 'number') {
      try {
        return `Created ${new Date(model.created * 1000).toLocaleDateString()}`
      } catch {
        return `Created ${model.created}`
      }
    }

    if (model.owned_by) {
      return `By ${model.owned_by}`
    }

    return 'Chat model'
  }, [])

  if (!isHost) {
    return (
      <Card className="border border-default-200 shadow-none">
        <CardHeader className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.4em] text-default-400">Agent status</p>
          <h2 className="text-lg font-semibold text-default-900">Host-managed models</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-default-600">
            {authorized
              ? `Host connected ${models.length} model${models.length === 1 ? '' : 's'}.`
              : 'Waiting for host to connect their local agent.'}
          </p>
        </CardBody>
      </Card>
    )
  }

  const connecting = agentState.status === 'connecting'
  const activeModelId = agentState.selectedModelId

  return (
    <Card className="border p-0 h-full w-full rounded-sm bg-transparent border-none shadow-none overflow-hidden">
      <CardHeader className="flex gap-1 p-0">
        <h2 className="text-lg !text-left font-semibold text-default-900">Agent manager</h2>
      </CardHeader>
      <CardBody className="space-y-4 px-0 overflow-y-auto pr-1 max-h-full">
        <Tabs
          fullWidth
          color="primary"
          selectedKey={provider}
          size="lg"
          variant="solid"
          onSelectionChange={handleProviderChange}
        >
          <Tab
            key="lmstudio-local"
            title={
              <div className="flex items-center gap-2">
                <Image alt="LM Studio" className="h-4 w-4" height={16} src="/lmstudio.png" width={16} />
                <span>{AI_ROOM_COPY.setupPanel.tabs.local}</span>
              </div>
            }
          />
          <Tab
            key="openai"
            title={
              <div className="flex items-center gap-2">
                <Image alt="OpenAI" className="h-4 w-4" height={16} src="/openai.png" width={16} />
                <span>{AI_ROOM_COPY.setupPanel.tabs.openai}</span>
              </div>
            }
          />
        </Tabs>

        {provider === 'lmstudio-local' ? (
          <div className="space-y-2">
            <Input
              label={AI_ROOM_COPY.setupPanel.local.urlLabel}
              labelPlacement="outside"
              placeholder={AI_ROOM_COPY.setupPanel.local.urlPlaceholder}
              value={lmTargetUrl}
              onChange={(event) => setLmTargetUrl(event.target.value)}
            />
            <Button
              className="w-full"
              color="primary"
              isLoading={connecting}
              variant="solid"
              onPress={connectLocalAgent}
            >
              {connecting ? AI_ROOM_COPY.setupPanel.local.buttonConnecting : AI_ROOM_COPY.setupPanel.local.button}
            </Button>
            <p className="text-[11px] text-default-500">{AI_ROOM_COPY.setupPanel.local.urlHelper}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agentState.sourceType === 'openai' && agentState.status === 'ready' && !editingOpenAIKey ? (
              <div className="space-y-2 rounded-2xl border border-success-200 bg-success-50/40 p-3 text-sm text-success-800">
                <p>OpenAI connected. Model list refreshed from your account.</p>
                <Button
                  color="success"
                  size="sm"
                  variant="bordered"
                  onPress={() => {
                    setEditingOpenAIKey(true)
                    setOpenAIKey('')
                  }}
                >
                  Change Key
                </Button>
              </div>
            ) : (
              <>
                <Input
                  label={AI_ROOM_COPY.setupPanel.openai.keyLabel}
                  labelPlacement="outside"
                  placeholder={AI_ROOM_COPY.setupPanel.openai.keyPlaceholder}
                  type="password"
                  value={openAIKey}
                  onChange={(event) => setOpenAIKey(event.target.value)}
                />
                <Button
                  className="w-full"
                  color="secondary"
                  isDisabled={!openAIKey.trim()}
                  isLoading={connecting}
                  variant="solid"
                  onPress={async () => {
                    await connectOpenAIAgent(openAIKey)
                    setOpenAIKey('')
                  }}
                >
                  {connecting ? AI_ROOM_COPY.setupPanel.openai.buttonConnecting : AI_ROOM_COPY.setupPanel.openai.button}
                </Button>
                <p className="text-[11px] text-default-500">{AI_ROOM_COPY.setupPanel.openai.keyHelper}</p>
              </>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center pb-4 justify-between text-xs text-default-500">
            <span className="text-lg !text-left font-semibold text-default-900">
              {AI_ROOM_COPY.setupPanel.local.detectedTitle}
            </span>
            <span className="text-default-400">
              {agentState.sourceType === 'openai'
                ? 'OpenAI'
                : agentState.sourceType === 'lmstudio-local'
                  ? 'LM Studio'
                  : 'Waiting'}
            </span>
          </div>
          {models.length === 0 ? (
            <p className="text-sm text-default-500">{AI_ROOM_COPY.setupPanel.local.detectedEmpty}</p>
          ) : (
            <Select
              disallowEmptySelection
              isVirtualized
              aria-label="Detected models"
              itemHeight={50}
              label="Choose a model"
              labelPlacement="outside"
              listboxProps={{ className: 'py-1' }}
              maxListboxHeight={200}
              scrollShadowProps={{ hideScrollBar: true }}
              selectedKeys={activeModelId ? new Set([activeModelId]) : new Set<string>()}
              selectionMode="single"
              onSelectionChange={handleModelSelection}
            >
              {models.map((model) => (
                <SelectItem key={model.id} className="h-12 py-1.5" textValue={model.id}>
                  <div className="flex flex-col gap-1 leading-tight overflow-hidden">
                    <span className="font-medium text-default-800">{model.id}</span>
                    <span className="text-xs text-default-400">{formatModelDetails(model)}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function ActivityCard({ hostEvents, hostPeerId }: { hostEvents: string[]; hostPeerId: string }) {
  return (
    <Card className="h-full min-h-0 !p-0 border-none bg-transparent shadow-none">
      <CardHeader className="flex  h-12 !p-0 !text-left gap-1">
        <h2 className="text-lg font-semibold text-default-900">{AI_ROOM_COPY.logPanel.title}</h2>
      </CardHeader>
      <CardBody className="!px-0 h-full min-h-0">
        <div className="h-full">
          {hostEvents.length === 0 ? (
            <p className="text-sm text-default-500">{AI_ROOM_COPY.logPanel.empty}</p>
          ) : (
            <ScrollShadow className="h-full max-h-full">
              <ul className="space-y-1.5 text-xs text-default-500">
                {hostEvents
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <li
                      key={`${entry}-${idx}`}
                      className="rounded-sm py-1 hover:bg-gradient-to-l from-default-50 to-transparent"
                    >
                      {entry}
                    </li>
                  ))}
              </ul>
            </ScrollShadow>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
