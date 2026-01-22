'use client'

import { useEffect, useMemo, useState } from 'react'

type MetricsPayload = {
  startedAt: number
  peerId: string
  topics: string[]
  onlinePeers?: { count: number; byTopic?: Record<string, number> }
  counters?: { totalMessages?: number; totalEvents?: number; byTopic?: Record<string, number> }
  invites?: {
    total?: number
    byType?: Record<string, number>
    byRoom?: Record<string, number>
  }
  roomTypes?: {
    messagesByType?: Record<string, number>
    messagesByRoom?: Record<string, number>
  }
  analytics?: {
    chatMessages?: { total?: number; byRoomType?: Record<string, number> }
    invites?: { total?: number; byRoomType?: Record<string, number> }
    agentChat?: {
      total?: number
      byVariant?: Record<string, number>
      byProvider?: Record<string, number>
      byModel?: Record<string, number>
      byRoom?: Record<string, { total: number; provider?: string | null; modelId?: string | null }>
    }
    streamChat?: { total?: number; byRoom?: Record<string, number> }
    streamSessions?: { totalMsByPeer?: Record<string, number>; totalMsByRoom?: Record<string, number> }
    billing?: { freeMinutes?: number; paidMinutes?: number; byPeer?: Record<string, number> }
  }
  derived?: {
    totalStreamMinutes?: number
    streamMinutesByRoom?: Record<string, number>
    streamMinutesByPeer?: Record<string, number>
  }
  uptimeMs: number
}

const METRICS_URL = '/api/metrics'

const formatNumber = (value?: number) => (typeof value === 'number' ? value.toLocaleString() : '0')

const formatUptime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours}h ${minutes}m ${seconds}s`
}

export function MetricsDashboard() {
  const [data, setData] = useState<MetricsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null

    const load = async () => {
      try {
        const res = await fetch(METRICS_URL, { cache: 'no-store' })

        if (!res.ok) {
          throw new Error(`Metrics responded with ${res.status}`)
        }

        const payload = (await res.json()) as MetricsPayload

        if (mounted) {
          setData(payload)
          setError(null)
          setLoading(false)
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message ?? 'Failed to load metrics')
          setLoading(false)
        }
      }
    }

    load()
    timer = setInterval(load, 3_000)

    return () => {
      mounted = false
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [])

  const topics = useMemo(() => data?.topics ?? [], [data?.topics])
  const onlineByTopic = data?.onlinePeers?.byTopic ?? {}
  const countersByTopic = data?.counters?.byTopic ?? {}
  const invitesByType = data?.analytics?.invites?.byRoomType ?? data?.invites?.byType ?? {}
  const messagesByType = data?.analytics?.chatMessages?.byRoomType ?? data?.roomTypes?.messagesByType ?? {}
  const agentByVariant = data?.analytics?.agentChat?.byVariant ?? {}
  const agentByProvider = data?.analytics?.agentChat?.byProvider ?? {}
  const agentByModel = data?.analytics?.agentChat?.byModel ?? {}
  const agentByRoom = data?.analytics?.agentChat?.byRoom ?? {}
  const streamChatTotal = data?.analytics?.streamChat?.total ?? 0
  const streamChatByRoom = data?.analytics?.streamChat?.byRoom ?? {}
  const fallbackStreamMinutesByRoom = Object.fromEntries(
    Object.entries(data?.analytics?.streamSessions?.totalMsByRoom ?? {}).map(([roomId, ms]) => [
      roomId,
      Math.round((Number(ms) || 0) / 60000),
    ]),
  )
  const streamMinutesByRoom = data?.analytics?.streamSessions?.totalMsByRoom ?? fallbackStreamMinutesByRoom
  const totalStreamMinutes =
    data?.derived?.totalStreamMinutes ??
    Object.values(streamMinutesByRoom).reduce((acc, value) => acc + (value ?? 0), 0)
  const billing = data?.analytics?.billing

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-8">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.2em] text-default-500">Analytics Agent</p>
        <h1 className="text-2xl font-semibold text-default-900">Tracks network activities in real-time</h1>
        <p>Archival Node: {data?.peerId}</p>
      </div>

      {loading ? <p className="text-sm text-default-500">Loading metrics...</p> : null}
      {error ? <p className="text-sm text-danger-500">{error}</p> : null}

      {data ? (
        <>
          <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
            <p className="text-xs uppercase text-default-400">Summary</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-default-700">
              <div className="flex items-center justify-between">
                <span>Peers Online</span>
                <span className="font-semibold">{formatNumber(data.onlinePeers?.count)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Events</span>
                <span className="font-semibold">{formatNumber(data.counters?.totalMessages)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Uptime</span>
                <span className="font-semibold">{formatUptime(data.uptimeMs)}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Stream Minutes</p>
              <p className="text-2xl font-semibold text-default-900">{formatNumber(totalStreamMinutes)}</p>
            </div>
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Paid Minutes</p>
              <p className="text-2xl font-semibold text-default-900">{formatNumber(billing?.paidMinutes ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Stream Chat Messages</p>
              <p className="text-2xl font-semibold text-default-900">{formatNumber(streamChatTotal)}</p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Room Invites</p>
              <div className="mt-2 flex flex-col gap-2 text-sm text-default-700">
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-semibold">
                    {formatNumber(data.analytics?.invites?.total ?? data.invites?.total)}
                  </span>
                </div>
                {Object.keys(invitesByType).length === 0 ? (
                  <p className="text-default-400">No invites yet.</p>
                ) : (
                  Object.entries(invitesByType).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="capitalize">{key}</span>
                      <span className="font-semibold">{formatNumber(value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Messages by Room Type</p>
              <div className="mt-2 flex flex-col gap-2 text-sm text-default-700">
                {Object.keys(messagesByType).length === 0 ? (
                  <p className="text-default-400">No room messages yet.</p>
                ) : (
                  Object.entries(messagesByType).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="capitalize">{key}</span>
                      <span className="font-semibold">{formatNumber(value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Agent Chat</p>
              <div className="mt-2 flex flex-col gap-2 text-sm text-default-700">
                <div className="flex items-center justify-between">
                  <span>User</span>
                  <span className="font-semibold">{formatNumber(agentByVariant.user ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Model</span>
                  <span className="font-semibold">{formatNumber(agentByVariant.model ?? 0)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Agent Providers</p>
              <div className="mt-2 flex flex-col gap-2 text-sm text-default-700">
                {Object.keys(agentByProvider).length === 0 ? (
                  <p className="text-default-400">No provider data yet.</p>
                ) : (
                  Object.entries(agentByProvider).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="capitalize">{key}</span>
                      <span className="font-semibold">{formatNumber(value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Agent Models</p>
              <div className="mt-2 flex flex-col gap-2 text-sm text-default-700">
                {Object.keys(agentByModel).length === 0 ? (
                  <p className="text-default-400">No model data yet.</p>
                ) : (
                  Object.entries(agentByModel).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="truncate">{key}</span>
                      <span className="font-semibold">{formatNumber(value)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Agent Rooms</p>
              {Object.keys(agentByRoom).length === 0 ? (
                <p className="mt-2 text-sm text-default-400">No agent rooms yet.</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-default-700">
                  {Object.entries(agentByRoom).map(([roomId, info]) => (
                    <div key={roomId} className="flex items-center justify-between gap-3">
                      <a className="truncate text-primary-600 hover:underline" href={`/agent/${roomId}`}>
                        {roomId}
                      </a>
                      <span className="text-xs text-default-500">
                        {info?.provider ?? 'unknown'} · {info?.modelId ?? 'unknown'}
                      </span>
                      <span className="font-semibold">{formatNumber(info?.total ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
              <p className="text-xs uppercase text-default-400">Stream Rooms</p>
              {Object.keys(streamChatByRoom).length === 0 ? (
                <p className="mt-2 text-sm text-default-400">No stream rooms yet.</p>
              ) : (
                <div className="mt-2 space-y-2 text-sm text-default-700">
                  {Object.entries(streamChatByRoom).map(([roomId, count]) => (
                    <div key={roomId} className="flex items-center justify-between gap-3">
                      <a className="truncate text-primary-600 hover:underline" href={`/stream/${roomId}`}>
                        {roomId}
                      </a>
                      <span className="font-semibold">{formatNumber(count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
            <p className="text-xs uppercase text-default-400">Stream Minutes by Room</p>
            {Object.keys(streamMinutesByRoom).length === 0 ? (
              <p className="mt-2 text-sm text-default-400">No stream minutes yet.</p>
            ) : (
              <div className="mt-2 space-y-2 text-sm text-default-700">
                {Object.entries(streamMinutesByRoom).map(([roomId, minutes]) => (
                  <div key={roomId} className="flex items-center justify-between gap-3">
                    <a className="truncate text-primary-600 hover:underline" href={`/stream/${roomId}`}>
                      {roomId}
                    </a>
                    <span className="font-semibold">{formatNumber(minutes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
            <p className="text-xs uppercase text-default-400">Peers by Topic</p>
            <div className="mt-2 grid gap-2 text-sm text-default-700 md:grid-cols-2">
              {topics.map((topic) => (
                <div key={topic} className="flex items-center justify-between">
                  <span className="truncate">{topic}</span>
                  <span className="font-semibold">{formatNumber(onlineByTopic[topic] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-default-200 bg-default-100 p-4 shadow-sm">
            <p className="text-xs uppercase text-default-400">Messages by Topic</p>
            <div className="mt-2 grid gap-2 text-sm text-default-700 md:grid-cols-2">
              {topics.map((topic) => (
                <div key={topic} className="flex items-center justify-between">
                  <span className="truncate">{topic}</span>
                  <span className="font-semibold">{formatNumber(countersByTopic[topic] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
