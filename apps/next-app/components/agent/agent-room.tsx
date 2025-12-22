'use client'

import type { AgentManagerState } from '@/lib/agent-manager'
import type { LMStudioModel } from '@/lib/lmstudio'

import { useMemo } from 'react'
import { Button, Card, CardBody, CardHeader, Chip, Input, ScrollShadow, Snippet } from '@heroui/react'
import clsx from 'clsx'

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
    connectLocalAgent,
    selectAgentModel,
    hostEvents,
    connectedViewers,
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
            isHost={isHost}
            lmBaseUrl={lmBaseUrl}
            models={models}
            selectAgentModel={selectAgentModel}
            setLmBaseUrl={setLmBaseUrl}
          />
          <ConnectedViewersCard connectedViewers={connectedViewers} />
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
  setLmBaseUrl: (url: string) => void
  connectLocalAgent: () => Promise<void>
  selectAgentModel: (modelId: string | null) => void
  authorized: boolean
}

function AgentManagerPanel({
  isHost,
  agentState,
  models,
  lmBaseUrl,
  setLmBaseUrl,
  connectLocalAgent,
  selectAgentModel,
  authorized,
}: AgentManagerPanelProps) {
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
        <div className="space-y-2">
          <Input
            label="LM Studio base URL"
            labelPlacement="outside"
            placeholder="http://127.0.0.1:1234"
            value={lmBaseUrl}
            onChange={(event) => setLmBaseUrl(event.target.value)}
          />
          <Button className="w-full" color="primary" isLoading={connecting} variant="solid" onPress={connectLocalAgent}>
            {authorized ? 'Reconnect' : 'Connect to LM Studio'}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-default-400">Detected Models</p>
          {models.length === 0 ? (
            <p className="text-sm text-default-500">
              No models found yet. Connect to LM Studio after loading a local model.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  className={clsx(
                    'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                    model.id === activeModelId
                      ? 'border-primary-200 bg-primary-50 text-primary-800'
                      : 'border-default-200 bg-default-50 text-default-700 hover:border-primary-200',
                  )}
                  onClick={() => selectAgentModel(model.id)}
                >
                  <span>{model.id}</span>
                  {model.id === activeModelId ? (
                    <Chip color="success" size="sm" variant="flat">
                      active
                    </Chip>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function ConnectedViewersCard({ connectedViewers }: { connectedViewers: string[] }) {
  return (
    <Card className="border border-default-200 shadow-none">
      <CardHeader className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.4em] text-default-400">Viewers</p>
        <h2 className="text-lg font-semibold text-default-900">Connected peers</h2>
      </CardHeader>
      <CardBody>
        {connectedViewers.length === 0 ? (
          <p className="text-sm text-default-500">No viewers connected yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-default-800">
            {connectedViewers.map((viewerId) => (
              <li
                key={viewerId}
                className="flex items-center justify-between rounded-xl border border-default-100 bg-white/80 px-3 py-2"
              >
                <span className="font-mono text-xs">{viewerId}</span>
                <Chip color="success" size="sm" variant="flat">
                  live
                </Chip>
              </li>
            ))}
          </ul>
        )}
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
