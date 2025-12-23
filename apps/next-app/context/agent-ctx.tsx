'use client'

import type { Message } from '@libp2p/interface'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { useChatContext } from '@/context/chat-ctx'
import {
  AGENT_SIGNAL_APP_ID,
  AGENT_SIGNAL_TOPIC,
  AGENT_SIGNAL_WRAPPER,
  CHAT_TOPIC,
  LM_STUDIO_DEFAULT_BASE_URL,
} from '@/config/constants'
import { createLMStudioChatCompletion, type LMStudioModel } from '@/lib/lmstudio'
import { forComponent } from '@/lib/logger'
import { buildAgentChatPayload, parseAgentChatPayload, type AgentChatPayload } from '@/lib/agent-chat'
import { AgentManager, createAgentManagerState, type AgentManagerState } from '@/lib/agent-manager'

const textEncoder = new TextEncoder()

const log = forComponent('agent-context')

type AgentSignalAction = 'viewer-offer' | 'viewer-ice' | 'host-answer' | 'host-ice'

interface AgentSignalMessage {
  hostPeerId: string
  action: AgentSignalAction
  from: string
  to?: string
  payload?: any
}

interface AgentSignalEnvelope {
  type: typeof AGENT_SIGNAL_WRAPPER
  app: typeof AGENT_SIGNAL_APP_ID
  payload: AgentSignalMessage
}

type AgentStatus = 'idle' | 'connecting' | 'waiting-host' | 'ready' | 'error'
type HostStatus = 'idle' | 'authorizing' | 'ready' | 'error'

export type AgentChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  modelId?: string
  createdAt: number
  status?: 'pending' | 'ready' | 'error'
}

export interface AgentContextValue {
  hostPeerId: string
  selfPeerId: string | null
  isHost: boolean
  agentStatus: AgentStatus
  hostStatus: HostStatus
  error?: string | null
  authorized: boolean
  models: LMStudioModel[]
  agentState: AgentManagerState
  lmBaseUrl: string
  setLmBaseUrl: (url: string) => void
  connectLocalAgent: () => Promise<void>
  selectAgentModel: (modelId: string | null) => void
  sendPrompt: (prompt: string, options?: { promptId?: string; modelId?: string }) => Promise<void>
  chatHistory: AgentChatMessage[]
  selectedModelId: string | null
  hostEvents: string[]
  connectedViewers: string[]
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined)

const ICE_SERVERS: RTCConfiguration['iceServers'] = [{ urls: ['stun:stun.l.google.com:19302'] }]

type HostPeerConnection = {
  pc: RTCPeerConnection
  channel?: RTCDataChannel
}

type PendingPrompt = {
  controller: AbortController
  modelId: string
}

type QueuedPrompt = {
  promptId: string
  prompt: string
  modelId: string
  requesterPeerId: string
}

export function AgentProvider({ hostPeerId, children }: { hostPeerId: string; children: ReactNode }) {
  const { libp2p } = useLibp2pContext()
  const { messageHistory, setMessageHistory } = useChatContext()
  const selfPeerId = libp2p.peerId?.toString() ?? null
  const isHost = selfPeerId === hostPeerId
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle')
  const [hostStatus, setHostStatus] = useState<HostStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<AgentChatMessage[]>([])
  const [agentState, setAgentState] = useState<AgentManagerState>(() => createAgentManagerState())
  const [lmBaseUrl, setLmBaseUrl] = useState<string>(LM_STUDIO_DEFAULT_BASE_URL)
  const [hostEvents, setHostEvents] = useState<string[]>([])
  const [connectedViewers, setConnectedViewers] = useState<string[]>([])
  const agentManagerRef = useRef<AgentManager | null>(null)
  const hostConnectionsRef = useRef<Map<string, HostPeerConnection>>(new Map())
  const viewerPeerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const viewerChannelRef = useRef<RTCDataChannel | null>(null)
  const pendingViewerIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())
  const pendingPromptsRef = useRef<Map<string, PendingPrompt>>(new Map())
  const processedPromptIdsRef = useRef<Set<string>>(new Set())
  const promptQueueRef = useRef<QueuedPrompt[]>([])
  const processingPromptRef = useRef(false)
  const appendChatPayload = useCallback(
    (payload: AgentChatPayload) => {
      const encoded = JSON.stringify(payload)
      const peerId = payload.senderPeerId || hostPeerId

      setMessageHistory((prev) => [
        ...prev,
        {
          msgId: crypto.randomUUID(),
          msg: encoded,
          fileObjectUrl: undefined,
          peerId,
          read: true,
          receivedAt: Date.now(),
          status: 'sent',
          channel: 'agent',
        },
      ])

      return encoded
    },
    [hostPeerId, setMessageHistory],
  )
  const appendHostEvent = useCallback((event: string) => {
    setHostEvents((prev) => [...prev.slice(-15), event])
  }, [])

  const authorized = agentState.status === 'ready'
  const models = agentState.models
  const selectedModelId = agentState.selectedModelId

  const publishAgentError = useCallback(
    async ({ promptId, message, modelId }: { promptId: string; message: string; modelId?: string }) => {
      const senderPeerId = libp2p.peerId?.toString() ?? hostPeerId
      const errorPayload = buildAgentChatPayload({
        agentPeerId: hostPeerId,
        body: message,
        senderPeerId,
        variant: 'model',
        modelId,
        promptId,
        status: 'error',
      })

      appendChatPayload(errorPayload)
      await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(JSON.stringify(errorPayload)))
    },
    [appendChatPayload, hostPeerId, libp2p.peerId, libp2p.services.pubsub],
  )

  const buildStatusPayload = useCallback(
    (message?: string) =>
      JSON.stringify({
        type: 'status',
        message,
        agentState,
      }),
    [agentState],
  )

  const sendHostStatusToViewers = useCallback(
    (message?: string) => {
      const payload = buildStatusPayload(message)

      hostConnectionsRef.current.forEach(({ channel }) => {
        if (channel?.readyState === 'open') {
          channel.send(payload)
        }
      })
    },
    [buildStatusPayload],
  )

  const registerViewer = useCallback((peerId: string) => {
    setConnectedViewers((prev) => {
      if (prev.includes(peerId)) {
        return prev
      }

      return [...prev, peerId]
    })
  }, [])

  const unregisterViewer = useCallback((peerId: string) => {
    setConnectedViewers((prev) => prev.filter((id) => id !== peerId))
  }, [])

  const runPromptJob = useCallback(
    async ({ promptId, prompt, modelId, requesterPeerId }: QueuedPrompt) => {
      const senderPeerId = libp2p.peerId?.toString() ?? hostPeerId
      const controller = new AbortController()

      pendingPromptsRef.current.set(promptId, { controller, modelId })

      const pendingPayload = buildAgentChatPayload({
        agentPeerId: hostPeerId,
        body: 'Agent is thinking...',
        senderPeerId,
        variant: 'model',
        modelId,
        promptId,
        status: 'pending',
      })

      appendChatPayload(pendingPayload)
      await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(JSON.stringify(pendingPayload)))

      try {
        const result = await createLMStudioChatCompletion({
          baseUrl: lmBaseUrl,
          modelId,
          prompt,
          signal: controller.signal,
        })

        const channel = hostConnectionsRef.current.get(requesterPeerId)?.channel

        if (channel?.readyState === 'open') {
          channel.send(
            JSON.stringify({
              type: 'chat_response',
              promptId,
              modelId,
              response: result.text,
            }),
          )
        }

        const responsePayload = buildAgentChatPayload({
          agentPeerId: hostPeerId,
          body: result.text,
          senderPeerId,
          variant: 'model',
          modelId,
          promptId,
          status: 'complete',
        })

        appendChatPayload(responsePayload)
        await libp2p.services.pubsub.publish(CHAT_TOPIC, textEncoder.encode(JSON.stringify(responsePayload)))
      } catch (err: any) {
        const channel = hostConnectionsRef.current.get(requesterPeerId)?.channel

        if (channel?.readyState === 'open') {
          channel.send(
            JSON.stringify({
              type: 'error',
              promptId,
              message: err?.message ?? 'Failed to run LM Studio completion.',
            }),
          )
        }

        await publishAgentError({
          promptId,
          message: err?.message ?? 'Failed to run LM Studio completion.',
          modelId,
        })
      } finally {
        pendingPromptsRef.current.delete(promptId)
      }
    },
    [appendChatPayload, hostPeerId, libp2p.peerId, libp2p.services.pubsub, lmBaseUrl, publishAgentError],
  )

  const processPromptQueue = useCallback(() => {
    if (processingPromptRef.current) {
      return
    }

    const next = promptQueueRef.current.shift()

    if (!next) {
      return
    }

    processingPromptRef.current = true

    runPromptJob(next)
      .catch((err) => {
        log.error('failed to process prompt job %o', err)
      })
      .finally(() => {
        processingPromptRef.current = false
        if (promptQueueRef.current.length > 0) {
          processPromptQueue()
        }
      })
  }, [runPromptJob])

  const enqueuePromptJob = useCallback(
    (job: QueuedPrompt) => {
      promptQueueRef.current.push(job)
      processPromptQueue()
    },
    [processPromptQueue],
  )

  useEffect(() => {
    if (!isHost) {
      agentManagerRef.current = null

      return
    }

    if (!agentManagerRef.current) {
      agentManagerRef.current = new AgentManager()
    }

    const manager = agentManagerRef.current

    setAgentState(manager.getState())

    return manager.subscribe((state) => {
      setAgentState(state)
    })
  }, [isHost])

  useEffect(() => {
    if (isHost && agentState.baseUrl) {
      setLmBaseUrl(agentState.baseUrl)
    }
  }, [agentState.baseUrl, isHost])

  const cleanupViewerConnection = useCallback(() => {
    viewerChannelRef.current?.close()
    viewerPeerConnectionRef.current?.close()
    viewerChannelRef.current = null
    viewerPeerConnectionRef.current = null
    setChatHistory([])
    setAgentStatus('idle')
  }, [])

  const publishSignal = useCallback(
    async (message: Omit<AgentSignalMessage, 'from' | 'hostPeerId'>) => {
      if (!selfPeerId) {
        return
      }

      const payload: AgentSignalMessage = {
        ...message,
        from: selfPeerId,
        hostPeerId,
      }

      const envelope: AgentSignalEnvelope = {
        type: AGENT_SIGNAL_WRAPPER,
        app: AGENT_SIGNAL_APP_ID,
        payload,
      }

      try {
        await libp2p.services.pubsub.publish(AGENT_SIGNAL_TOPIC, uint8ArrayFromString(JSON.stringify(envelope)))
      } catch (e: any) {
        log.error('failed to publish agent signal %o', e)
        setError(e?.message ?? 'failed to publish signal')
      }
    },
    [hostPeerId, libp2p.services.pubsub, selfPeerId],
  )

  const connectLocalAgent = useCallback(async () => {
    if (!isHost) {
      return
    }

    if (!agentManagerRef.current) {
      agentManagerRef.current = new AgentManager()
    }

    try {
      setHostStatus('authorizing')
      setError(null)
      await agentManagerRef.current.connectLocalLMStudio(lmBaseUrl)
      appendHostEvent('Local LM Studio connected')
      setHostStatus('ready')
      sendHostStatusToViewers('Host connected to LM Studio')
    } catch (e: any) {
      log.error('failed to connect LM Studio %o', e)
      setError(e?.message ?? 'failed to contact LM Studio')
      setHostStatus('error')
    }
  }, [appendHostEvent, isHost, lmBaseUrl, sendHostStatusToViewers])

  const selectAgentModel = useCallback(
    (modelId: string | null) => {
      if (!isHost) {
        return
      }

      if (!agentManagerRef.current) {
        agentManagerRef.current = new AgentManager()
      }

      agentManagerRef.current.selectModel(modelId)
      appendHostEvent(modelId ? `Model selected: ${modelId}` : 'Model selection cleared')
      sendHostStatusToViewers('Host updated model selection')
    },
    [appendHostEvent, isHost, sendHostStatusToViewers],
  )

  const handleViewerDataMessage = useCallback(
    async (peerId: string, event: MessageEvent) => {
      if (!isHost) {
        return
      }

      try {
        const data = JSON.parse(event.data)

        switch (data?.type) {
          case 'status_probe': {
            const conn = hostConnectionsRef.current.get(peerId)?.channel

            if (conn?.readyState === 'open') {
              conn.send(buildStatusPayload())
            }
            break
          }
          case 'chat_prompt': {
            if (!authorized || models.length === 0) {
              const message = 'Host has not connected a local model yet.'
              const conn = hostConnectionsRef.current.get(peerId)?.channel

              if (conn?.readyState === 'open') {
                conn.send(
                  JSON.stringify({
                    type: 'error',
                    promptId: data?.promptId,
                    message,
                  }),
                )
              }

              if (typeof data?.promptId === 'string') {
                await publishAgentError({ promptId: data.promptId, message })
              }

              return
            }

            const targetModel = typeof data?.modelId === 'string' ? data.modelId : models[0]?.id

            if (!targetModel) {
              const message = 'Host has no available models.'
              const conn = hostConnectionsRef.current.get(peerId)?.channel

              conn?.send(
                JSON.stringify({
                  type: 'error',
                  promptId: data?.promptId,
                  message,
                }),
              )

              if (typeof data?.promptId === 'string') {
                await publishAgentError({ promptId: data.promptId, message })
              }

              return
            }

            const promptId = typeof data?.promptId === 'string' ? data.promptId : crypto.randomUUID()

            if (processedPromptIdsRef.current.has(promptId)) {
              break
            }

            processedPromptIdsRef.current.add(promptId)
            appendHostEvent(`Prompt from ${peerId.slice(-6)} (${targetModel})`)
            enqueuePromptJob({
              promptId,
              prompt: String(data?.prompt ?? ''),
              modelId: targetModel,
              requesterPeerId: peerId,
            })
            break
          }
          default:
            break
        }
      } catch (e) {
        log.error('failed to parse viewer data message %o', e)
      }
    },
    [appendHostEvent, authorized, buildStatusPayload, enqueuePromptJob, isHost, models, publishAgentError],
  )

  const setupHostDataChannel = useCallback(
    (peerId: string, channel: RTCDataChannel) => {
      channel.onopen = () => {
        appendHostEvent(`Viewer ${peerId.slice(-6)} connected`)
        sendHostStatusToViewers('Host ready')
        registerViewer(peerId)
      }
      channel.onclose = () => {
        appendHostEvent(`Viewer ${peerId.slice(-6)} disconnected`)
        hostConnectionsRef.current.delete(peerId)
        unregisterViewer(peerId)
      }
      channel.onmessage = (event) => handleViewerDataMessage(peerId, event)
    },
    [appendHostEvent, handleViewerDataMessage, registerViewer, sendHostStatusToViewers, unregisterViewer],
  )

  const ensureHostPeerConnection = useCallback(
    (viewerPeer: string) => {
      const existing = hostConnectionsRef.current.get(viewerPeer)

      if (existing) {
        return existing.pc
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          publishSignal({
            action: 'host-ice',
            to: viewerPeer,
            payload: { candidate: event.candidate.toJSON() },
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'closed'
        ) {
          hostConnectionsRef.current.delete(viewerPeer)
          unregisterViewer(viewerPeer)
          pc.close()
        }
      }

      const channel = pc.createDataChannel('lm-agent')

      setupHostDataChannel(viewerPeer, channel)
      hostConnectionsRef.current.set(viewerPeer, { pc, channel })

      return pc
    },
    [publishSignal, setupHostDataChannel, unregisterViewer],
  )

  const handleViewerOffer = useCallback(
    async (signal: AgentSignalMessage) => {
      if (!isHost) {
        return
      }

      const viewerPeer = signal.from
      const pc = ensureHostPeerConnection(viewerPeer)

      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.payload?.sdp })
        const pending = pendingViewerIceRef.current.get(viewerPeer)

        if (pending?.length) {
          for (const candidate of pending) {
            try {
              await pc.addIceCandidate(candidate)
            } catch (candidateError) {
              log.error('failed to add pending viewer ice %o', candidateError)
            }
          }
          pendingViewerIceRef.current.delete(viewerPeer)
        }

        const answer = await pc.createAnswer()

        await pc.setLocalDescription(answer)
        await publishSignal({
          action: 'host-answer',
          to: viewerPeer,
          payload: { sdp: answer.sdp },
        })
      } catch (e: any) {
        log.error('failed to handle viewer offer %o', e)
      }
    },
    [ensureHostPeerConnection, hostPeerId, isHost, publishSignal],
  )

  const handleViewerIce = useCallback(
    async (signal: AgentSignalMessage) => {
      if (!isHost) {
        return
      }

      const viewerPeer = signal.from
      const candidate = signal.payload?.candidate

      if (!candidate) {
        return
      }

      const peerConnection = hostConnectionsRef.current.get(viewerPeer)?.pc

      if (!peerConnection) {
        const existing = pendingViewerIceRef.current.get(viewerPeer) ?? []

        pendingViewerIceRef.current.set(viewerPeer, [...existing, candidate])

        return
      }

      try {
        await peerConnection.addIceCandidate(candidate)
      } catch (error) {
        log.error('failed to add viewer ice %o', error)
      }
    },
    [isHost],
  )

  useEffect(() => {
    if (!isHost) {
      return
    }

    sendHostStatusToViewers()
  }, [agentState, isHost, sendHostStatusToViewers])

  useEffect(() => {
    if (!isHost) {
      return
    }

    messageHistory.forEach((message) => {
      const payload = parseAgentChatPayload(message.msg)

      if (!payload) {
        return
      }

      if (payload.agentPeerId !== hostPeerId) {
        return
      }

      if (payload.variant !== 'user') {
        return
      }

      if (!payload.promptId || processedPromptIdsRef.current.has(payload.promptId)) {
        return
      }

      if (payload.senderPeerId === (libp2p.peerId?.toString() ?? hostPeerId)) {
        return
      }

      const targetModel = payload.modelId ?? agentState.selectedModelId ?? agentState.models[0]?.id

      processedPromptIdsRef.current.add(payload.promptId)

      if (!targetModel) {
        publishAgentError({
          promptId: payload.promptId,
          message: 'Host has no available models.',
        })

        return
      }

      appendHostEvent(`Prompt from ${payload.senderPeerId.slice(-6)} (${targetModel})`)
      enqueuePromptJob({
        promptId: payload.promptId,
        prompt: payload.body,
        modelId: targetModel,
        requesterPeerId: payload.senderPeerId,
      })
    })
  }, [
    agentState.models,
    agentState.selectedModelId,
    appendHostEvent,
    enqueuePromptJob,
    hostPeerId,
    isHost,
    libp2p.peerId,
    messageHistory,
    publishAgentError,
  ])

  useEffect(() => {
    return () => {
      hostConnectionsRef.current.forEach(({ pc, channel }, peerId) => {
        channel?.close()
        pc.close()
        unregisterViewer(peerId)
      })
      hostConnectionsRef.current.clear()
    }
  }, [unregisterViewer])

  const handleHostAnswer = useCallback(
    async (signal: AgentSignalMessage) => {
      if (isHost) {
        return
      }

      const pc = viewerPeerConnectionRef.current

      if (!pc) {
        return
      }

      try {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.payload?.sdp })
      } catch (e: any) {
        log.error('failed to set remote description %o', e)
        setAgentStatus('error')
        setError(e?.message ?? 'failed to apply host answer')
      }
    },
    [isHost],
  )

  const handleHostIce = useCallback(
    async (signal: AgentSignalMessage) => {
      if (isHost) {
        return
      }

      const candidate = signal.payload?.candidate
      const pc = viewerPeerConnectionRef.current

      if (!pc || !candidate) {
        return
      }

      try {
        await pc.addIceCandidate(candidate)
      } catch (e: any) {
        log.error('failed to add host ice %o', e)
      }
    },
    [isHost],
  )

  const handleSignalMessage = useCallback(
    async (evt: CustomEvent<Message>) => {
      if (evt.detail.topic !== AGENT_SIGNAL_TOPIC) {
        return
      }

      if (evt.detail.type !== 'signed') {
        return
      }

      let payload: AgentSignalEnvelope

      try {
        payload = JSON.parse(uint8ArrayToString(evt.detail.data))

        if (payload?.type !== AGENT_SIGNAL_WRAPPER || payload?.app !== AGENT_SIGNAL_APP_ID) {
          return
        }
      } catch (e) {
        log.error('failed to parse agent signal %o', e)

        return
      }

      if (payload.payload.hostPeerId !== hostPeerId) {
        return
      }

      switch (payload.payload.action) {
        case 'viewer-offer':
          await handleViewerOffer(payload.payload)
          break
        case 'viewer-ice':
          await handleViewerIce(payload.payload)
          break
        case 'host-answer':
          await handleHostAnswer(payload.payload)
          break
        case 'host-ice':
          await handleHostIce(payload.payload)
          break
        default:
          break
      }
    },
    [handleHostAnswer, handleHostIce, handleViewerIce, handleViewerOffer, hostPeerId],
  )

  useEffect(() => {
    libp2p.services.pubsub.addEventListener('message', handleSignalMessage)

    return () => {
      libp2p.services.pubsub.removeEventListener('message', handleSignalMessage)
    }
  }, [handleSignalMessage, libp2p.services.pubsub])

  const setupViewerDataChannel = useCallback(
    (channel: RTCDataChannel) => {
      viewerChannelRef.current = channel
      channel.onopen = () => {
        setAgentStatus('waiting-host')
        setError(null)
        try {
          channel.send(
            JSON.stringify({
              type: 'status_probe',
              requestedAt: Date.now(),
            }),
          )
        } catch (error) {
          log.error('failed to send status probe %o', error)
        }
      }
      channel.onclose = () => {
        setAgentStatus('idle')
        setError('Connection closed by host.')
      }
      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data?.type) {
            case 'status': {
              const nextState = data?.agentState

              if (nextState) {
                setAgentState({
                  sourceType: nextState.sourceType ?? null,
                  status: nextState.status ?? 'idle',
                  models: Array.isArray(nextState.models) ? nextState.models : [],
                  selectedModelId: typeof nextState.selectedModelId === 'string' ? nextState.selectedModelId : null,
                  baseUrl: typeof nextState.baseUrl === 'string' ? nextState.baseUrl : undefined,
                  error: typeof nextState.error === 'string' ? nextState.error : null,
                })
              }
              if (nextState?.status === 'ready') {
                setAgentStatus('ready')
                setError(null)
              } else {
                setAgentStatus('waiting-host')
                if (typeof data?.message === 'string') {
                  setError(data.message)
                }
              }
              break
            }
            case 'chat_response':
              setChatHistory((prev): AgentChatMessage[] => {
                let matched = false
                const updated = prev.map((msg): AgentChatMessage => {
                  if (msg.id === data?.promptId && msg.role === 'assistant') {
                    matched = true

                    return {
                      ...msg,
                      content: typeof data?.response === 'string' ? data.response : msg.content,
                      modelId: typeof data?.modelId === 'string' ? data.modelId : msg.modelId,
                      status: 'ready',
                    }
                  }

                  return msg
                })

                if (matched) {
                  return updated
                }

                const response: AgentChatMessage = {
                  id: typeof data?.promptId === 'string' ? data.promptId : crypto.randomUUID(),
                  role: 'assistant',
                  content: typeof data?.response === 'string' ? data.response : 'Received response',
                  createdAt: Date.now(),
                  modelId: typeof data?.modelId === 'string' ? data.modelId : undefined,
                  status: 'ready',
                }

                return [...prev, response]
              })
              break
            case 'error':
              if (data?.promptId) {
                setChatHistory((prev) =>
                  prev.map((msg) =>
                    msg.id === data.promptId && msg.role === 'assistant'
                      ? {
                          ...msg,
                          content: typeof data?.message === 'string' ? data.message : 'Host reported an error.',
                          status: 'error',
                        }
                      : msg,
                  ),
                )
              } else if (typeof data?.message === 'string') {
                setError(data.message)
              }
              break
            default:
              break
          }
        } catch (e) {
          log.error('failed to parse agent data message %o', e)
        }
      }
    },
    [selectedModelId],
  )

  const startViewerConnection = useCallback(async () => {
    if (isHost || viewerPeerConnectionRef.current || !selfPeerId) {
      return
    }

    setAgentStatus('connecting')
    setError(null)

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    viewerPeerConnectionRef.current = pc

    pc.ondatachannel = (event) => setupViewerDataChannel(event.channel)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        publishSignal({
          action: 'viewer-ice',
          payload: { candidate: event.candidate.toJSON() },
          to: hostPeerId,
        })
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        setAgentStatus('error')
        setError('Failed to connect to host.')
      }
    }

    try {
      const offer = await pc.createOffer()

      await pc.setLocalDescription(offer)
      await publishSignal({
        action: 'viewer-offer',
        payload: { sdp: offer.sdp },
        to: hostPeerId,
      })
    } catch (e: any) {
      log.error('failed to start viewer connection %o', e)
      setAgentStatus('error')
      setError(e?.message ?? 'failed to start viewer connection')
      cleanupViewerConnection()
    }
  }, [cleanupViewerConnection, hostPeerId, isHost, publishSignal, selfPeerId, setupViewerDataChannel])

  useEffect(() => {
    if (!isHost) {
      startViewerConnection().catch((err) => log.error('viewer start failed %o', err))
    }

    return () => {
      cleanupViewerConnection()
    }
  }, [cleanupViewerConnection, isHost, startViewerConnection])

  const markPromptAs = useCallback((promptId: string, update: { content: string; status: 'ready' | 'error' }) => {
    setChatHistory((prev) =>
      prev.map((msg) =>
        msg.id === promptId && msg.role === 'assistant'
          ? {
              ...msg,
              content: update.content,
              status: update.status,
            }
          : msg,
      ),
    )
  }, [])

  const sendPrompt = useCallback(
    async (prompt: string, options?: { promptId?: string; modelId?: string }) => {
      const trimmed = prompt.trim()

      if (!trimmed) {
        return
      }

      if (isHost) {
        setChatHistory((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'system',
            content: 'Host can only preview prompts on the viewer interface.',
            createdAt: Date.now(),
            status: 'error',
          },
        ])

        return
      }

      const promptId = options?.promptId ?? crypto.randomUUID()

      const model = options?.modelId ?? selectedModelId ?? models[0]?.id

      setChatHistory((prev) => [
        ...prev,
        {
          id: `${promptId}-user`,
          role: 'user',
          content: trimmed,
          createdAt: Date.now(),
          modelId: model,
        },
        {
          id: promptId,
          role: 'assistant',
          content: 'Waiting for host...',
          createdAt: Date.now(),
          modelId: model,
          status: 'pending',
        },
      ])

      const channel = viewerChannelRef.current

      if (channel?.readyState === 'open') {
        try {
          channel.send(
            JSON.stringify({
              type: 'chat_prompt',
              promptId,
              prompt: trimmed,
              modelId: model,
            }),
          )
        } catch (err) {
          log.error('failed to send viewer prompt over data channel %o', err)
        }
      }
    },
    [isHost, markPromptAs, models, selectedModelId],
  )

  useEffect(() => {
    if (!isHost) {
      setHostStatus('idle')
      setHostEvents([])
      setConnectedViewers([])
    }
  }, [isHost])

  const value: AgentContextValue = {
    hostPeerId,
    selfPeerId,
    isHost,
    agentStatus,
    hostStatus,
    error,
    authorized,
    models,
    agentState,
    lmBaseUrl,
    setLmBaseUrl,
    connectLocalAgent,
    selectAgentModel,
    sendPrompt,
    chatHistory,
    selectedModelId,
    hostEvents,
    connectedViewers,
  }

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export const useAgentContext = () => {
  const context = useContext(AgentContext)

  if (!context) {
    throw new Error('useAgentContext must be used within AgentProvider')
  }

  return context
}
