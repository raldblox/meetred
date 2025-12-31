'use client'

import type { Selection } from '@react-types/shared'
import type { AgentManagerState } from '@/lib/agent-manager'
import type { LMStudioModel } from '@/lib/lmstudio'

import { useEffect, useMemo, useState, useCallback } from 'react'
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
} from '@heroui/react'

import { useAgentContext } from '@/context/agent-ctx'
import { AgentChatPanel } from '@/components/agent/agent-chat-panel'
import { AI_ROOM_COPY } from '@/config/copy'

const statusColorMap: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'default'> = {
  idle: 'default',
  connecting: 'secondary',
  authorizing: 'secondary',
  'waiting-host': 'warning',
  ready: 'success',
  error: 'danger',
}

export function AgentRoom({ peerId }: { peerId: string }) {
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
  } = useAgentContext()

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

  if (!isHost) {
    return (
      <div className="mx-auto flex h-full min-h-0 max-w-4xl flex-col gap-4 p-4 overflow-hidden">
        <Card className="border border-default-200 shadow-none h-full">
          <CardHeader className="flex flex-col gap-1 pb-1">
            <p className="text-xs uppercase tracking-[0.4em] text-default-400">{AI_ROOM_COPY.chatPanel.titleReady}</p>
            <h2 className="text-lg font-semibold text-default-900">{chatTitle}</h2>
            <p className="text-xs text-default-500">{chatSubtitle}</p>
            {modelStatus ? <p className="text-xs text-default-500">{modelStatus}</p> : null}
          </CardHeader>
          <CardBody className="px-0 py-0 h-full">
            <AgentChatPanel agentPeerId={hostPeerId} />
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden">
      <header className="flex h-12 items-center gap-2 rounded-sm border border-default-200 bg-background/70 p-3">
        {/* <Chip color="secondary" size="sm" variant="flat">
            Peer ID
          </Chip>
          <Snippet
            hideSymbol
            className="flex-1 max-w-full overflow-hidden text-ellipsis"
            codeString={peerId}
            hideCopyButton={false}
            size="sm"
            variant="bordered"
          >
            <span className="text-xs">{peerId}</span>
          </Snippet> */}
        <Chip color={statusColorMap[hostStatus] ?? 'default'} size="sm" variant="dot">
          {`Host - ${hostStatus}`}
        </Chip>
        {error ? <div className="text-sm text-danger">{error}</div> : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-5 h-full min-h-0">
        <div className="h-full min-h-0">
          <ActivityCard hostEvents={hostEvents} hostPeerId={hostPeerId} />
        </div>
        <Card className="border md:col-span-3 rounded-sm border-default-200 shadow-none h-full">
          <CardBody className="px-0 py-0 h-full">
            <AgentChatPanel agentPeerId={hostPeerId} />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4 h-full min-h-0">
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
              aria-label="Detected models"
              label="Choose a model"
              labelPlacement="outside"
              selectedKeys={activeModelId ? new Set([activeModelId]) : new Set<string>()}
              selectionMode="single"
              onSelectionChange={handleModelSelection}
            >
              {models.map((model) => (
                <SelectItem key={model.id} textValue={model.id}>
                  <div className="flex flex-col">
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
      <CardHeader className="flex !p-0 !text-left gap-1">
        <h2 className="text-lg font-semibold text-default-900">{AI_ROOM_COPY.logPanel.title}</h2>
      </CardHeader>
      <CardBody className="!px-0 h-full min-h-0">
        <div className="h-full">
          {hostEvents.length === 0 ? (
            <p className="text-sm text-default-500">{AI_ROOM_COPY.logPanel.empty}</p>
          ) : (
            <ScrollShadow className="h-full max-h-full">
              <ul className="space-y-1.5 text-sm text-default-800">
                {hostEvents
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <li key={`${entry}-${idx}`} className="rounded-xl bg-default-50 px-3 py-2 shadow-sm">
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
