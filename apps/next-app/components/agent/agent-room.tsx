'use client'

import type { Selection } from '@react-types/shared'
import type { AgentManagerState } from '@/lib/agent-manager'
import type { LMStudioModel } from '@/lib/lmstudio'

import { useEffect, useMemo, useState, useCallback } from 'react'
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
  Snippet,
  Tab,
  Tabs,
} from '@heroui/react'
import { useAgentContext } from '@/context/agent-ctx'
import { AgentChatPanel } from '@/components/agent/agent-chat-panel'

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

  if (!isHost) {
    return (
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-4 p-4">
        <Card className="border border-default-200 shadow-none">
          <CardHeader className="flex flex-col gap-1 pb-1">
            <p className="text-xs uppercase tracking-[0.4em] text-default-400">Live chat</p>
            <h2 className="text-lg font-semibold text-default-900">Chat with the host agent</h2>
            <p className="text-xs text-default-500">
              {authorized
                ? activeModel
                  ? `Model - ${activeModel.id}`
                  : 'Host has not selected a model yet.'
                : 'Host is still connecting a model. Prompts will send once ready.'}
            </p>
          </CardHeader>
          <CardBody className="px-0 py-0">
            <AgentChatPanel agentPeerId={hostPeerId} />
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-2 rounded-2xl border border-default-200 bg-background/70 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Chip color="secondary" size="sm" variant="flat">
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
          </Snippet>
          <Chip color={statusColorMap[hostStatus] ?? 'default'} size="sm" variant="dot">
            {`Host - ${hostStatus}`}
          </Chip>
        </div>
        {error ? (
          <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-2 text-sm text-danger">{error}</div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border border-default-200 shadow-none">
          <CardHeader className="flex flex-col gap-1 pb-1">
            <p className="text-xs uppercase tracking-[0.4em] text-default-400">Live chat</p>
            <h2 className="text-lg font-semibold text-default-900">
              {authorized ? 'Connected to host agent' : 'Waiting for host to connect'}
            </h2>
            <p className="text-xs text-default-500">
              {authorized
                ? activeModel
                  ? `Model - ${activeModel.id}`
                  : 'Host has not selected a model yet.'
                : 'Once the host connects their model everyone can chat in real time.'}
            </p>
          </CardHeader>
          <CardBody className="px-0 py-0">
            <AgentChatPanel agentPeerId={hostPeerId} />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
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
          <ActivityCard hostEvents={hostEvents} hostPeerId={hostPeerId} />
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
    <Card className="border border-default-200 shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.4em] text-default-400">Agent manager</p>
        <h2 className="text-lg font-semibold text-default-900">Choose your model</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <Tabs
          fullWidth
          selectedKey={provider}
          variant="bordered"
          color="primary"
          onSelectionChange={handleProviderChange}
        >
          <Tab key="lmstudio-local" title="LM Studio" />
          <Tab key="openai" title="OpenAI" />
        </Tabs>

        {provider === 'lmstudio-local' ? (
          <div className="space-y-2">
            <Input
              label="LM Studio API URL"
              labelPlacement="outside"
              placeholder="http://127.0.0.1:1234"
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
              Grant Access
            </Button>
            <p className="text-[11px] text-default-500">
              Launch the local agent proxy (first field) and point it to your LM Studio HTTP endpoint (second field).
            </p>
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
                  label="OpenAI API Key"
                  labelPlacement="outside"
                  placeholder="sk-..."
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
                  Connect
                </Button>
                <p className="text-[11px] text-default-500">
                  Your key is encrypted inside the local agent and never leaves this machine.
                </p>
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-default-500 uppercase tracking-[0.3em]">
            <span>Detected Models</span>
            <span className="text-default-400">
              {agentState.sourceType === 'openai'
                ? 'OpenAI'
                : agentState.sourceType === 'lmstudio-local'
                  ? 'LM Studio'
                  : 'Waiting'}
            </span>
          </div>
          {models.length === 0 ? (
            <p className="text-sm text-default-500">
              {agentState.sourceType === 'openai'
                ? 'No models found yet. Ensure your OpenAI key has access to chat models.'
                : 'No models found yet. Connect to LM Studio after loading a local model.'}
            </p>
          ) : (
            <Select
              aria-label="Detected models"
              disallowEmptySelection
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
    <Card className="border border-default-200 shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.4em] text-default-400">Activity</p>
        <h2 className="text-lg font-semibold text-default-900">Agent log</h2>
      </CardHeader>
      <CardBody>
        <div className="rounded-2xl border border-default-100 bg-default-50 p-3">
          {hostEvents.length === 0 ? (
            <p className="text-sm text-default-500">No activity yet.</p>
          ) : (
            <ScrollShadow className="max-h-[280px] pr-2">
              <ul className="space-y-2 text-sm text-default-800">
                {hostEvents
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <li key={`${entry}-${idx}`} className="rounded-xl bg-white/70 px-3 py-2 shadow-sm">
                      {entry}
                    </li>
                  ))}
              </ul>
            </ScrollShadow>
          )}
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-default-400">
          Host peer - {hostPeerId.slice(-7)}
        </p>
      </CardBody>
    </Card>
  )
}
