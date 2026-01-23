'use client'

import type { PeerId, Message } from '@libp2p/interface'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { pipe } from 'it-pipe'
import map from 'it-map'
import * as lp from 'it-length-prefixed'
import { peerIdFromString } from '@libp2p/peer-id'

import { useLibp2pContext } from './libp2p-ctx'

import {
  AGENT_CHAT_TOPIC,
  CHAT_FILE_TOPIC,
  CHAT_TOPIC,
  FILE_EXCHANGE_PROTOCOL,
  MIME_TEXT_PLAIN,
  PUBSUB_PEER_DISCOVERY,
  STREAM_CHAT_TOPIC,
  STREAM_SIGNAL_APP_ID,
  STREAM_SIGNAL_WRAPPER,
} from '@/config/constants'
import { forComponent } from '@/lib/logger'
import { DirectMessageEvent, directMessageEvent } from '@/lib/direct-message'
import { decodeZeroWidth, unwrapMeetredMessage, wrapMeetredMessage } from '@/lib/envelope'
import { parseStreamChatPayload } from '@/lib/stream-chat'
import { parseAgentChatPayload } from '@/lib/agent-chat'

const log = forComponent('chat-context')

const hasFromPeer = (msg: Message): msg is Message & { from: PeerId } => {
  return typeof (msg as any)?.from !== 'undefined'
}

const isStreamSignal = (content: string) => {
  try {
    const parsed = JSON.parse(content)

    return parsed?.type === STREAM_SIGNAL_WRAPPER && parsed?.app === STREAM_SIGNAL_APP_ID
  } catch {
    return false
  }
}

const unwrapPublicMessage = (raw: string): string | null => {
  return unwrapMeetredMessage(raw)
}

const parseHistoryControlMessage = (content: string): HistoryControlMessage | null => {
  try {
    const parsed = JSON.parse(content)

    if (parsed?.kind === 'history_request' || parsed?.kind === 'history_response') {
      return parsed
    }
  } catch {
    // fall through for non-control messages
  }

  return null
}

const historySignature = (
  message: Pick<ChatMessage, 'peerId' | 'channel' | 'msg' | 'receivedAt'> & { msgId?: string },
) => {
  const channel = message.channel ?? 'public'
  const bucketedTime = Math.round(message.receivedAt / 1000) // coarse time bucket to help dedupe

  return `${message.peerId}-${channel}-${bucketedTime}-${message.msg}`
}

export interface ChatMessage {
  msgId: string
  msg: string
  fileObjectUrl: string | undefined
  fileName?: string
  fileType?: string
  peerId: string
  read: boolean
  receivedAt: number
  status?: 'pending' | 'sent' | 'failed'
  channel?: 'public' | 'agent' | 'stream' | 'dm'
}

export interface ChatFile {
  id: string
  body: Uint8Array
  sender: string
  name?: string
  type?: string
}

export interface DirectMessages {
  [peerId: string]: ChatMessage[]
}

type Chatroom = string

type HistoryRequest = {
  kind: 'history_request'
  since?: number
  limit?: number
  requester?: string
  via?: 'dm' | 'pubsub'
  scope?: 'public' | 'dm'
  peer?: string
}

type HistorySnapshotMessage = Pick<ChatMessage, 'msgId' | 'msg' | 'peerId' | 'receivedAt' | 'channel'>

type HistoryResponse = {
  kind: 'history_response'
  target?: string
  via?: 'dm' | 'pubsub'
  scope?: 'public' | 'dm'
  peer?: string
  messages: HistorySnapshotMessage[]
}

type HistoryControlMessage = HistoryRequest | HistoryResponse

export interface ChatContextInterface {
  messageHistory: ChatMessage[]
  setMessageHistory: (messageHistory: ChatMessage[] | ((prevMessages: ChatMessage[]) => ChatMessage[])) => void
  directMessages: DirectMessages
  setDirectMessages: (directMessages: DirectMessages | ((prevMessages: DirectMessages) => DirectMessages)) => void
  roomId: Chatroom
  setRoomId: (chatRoom: Chatroom) => void
  files: Map<string, ChatFile>
  setFiles: (files: Map<string, ChatFile>) => void
  historySyncingPeerIds: string[]
  networkTotals: NetworkTotals
  recordNetworkUsage: (
    direction: 'sent' | 'received',
    category: NetworkCategory,
    bytes: number,
    cachedBytesDelta?: number,
    cachedFilesDelta?: number,
  ) => void
}

export const ChatContext = createContext<ChatContextInterface>({
  messageHistory: [],
  setMessageHistory: () => {},
  directMessages: {},
  setDirectMessages: () => {},
  roomId: '',
  setRoomId: () => {},
  files: new Map<string, ChatFile>(),
  setFiles: () => {},
  historySyncingPeerIds: [],
  networkTotals: {
    sentBytes: 0,
    receivedBytes: 0,
    sentByCategory: {
      dm: 0,
      'pubsub-chat': 0,
      'pubsub-file-meta': 0,
      'pubsub-signal': 0,
      'file-transfer': 0,
    },
    receivedByCategory: {
      dm: 0,
      'pubsub-chat': 0,
      'pubsub-file-meta': 0,
      'pubsub-signal': 0,
      'file-transfer': 0,
    },
    cachedBytes: 0,
    cachedFiles: 0,
    lastUpdatedAt: 0,
  },
  recordNetworkUsage: () => {},
})

export const useChatContext = () => {
  return useContext(ChatContext)
}

type NetworkCategory =
  | 'dm'
  | 'pubsub-chat'
  | 'pubsub-file-meta'
  | 'pubsub-signal'
  | 'file-transfer'

export interface NetworkTotals {
  sentBytes: number
  receivedBytes: number
  sentByCategory: Record<NetworkCategory, number>
  receivedByCategory: Record<NetworkCategory, number>
  cachedBytes: number
  cachedFiles: number
  lastUpdatedAt: number
}

const buildEmptyStats = (): NetworkTotals => ({
  sentBytes: 0,
  receivedBytes: 0,
  sentByCategory: {
    dm: 0,
    'pubsub-chat': 0,
    'pubsub-file-meta': 0,
    'pubsub-signal': 0,
    'file-transfer': 0,
  },
  receivedByCategory: {
    dm: 0,
    'pubsub-chat': 0,
    'pubsub-file-meta': 0,
    'pubsub-signal': 0,
    'file-transfer': 0,
  },
  cachedBytes: 0,
  cachedFiles: 0,
  lastUpdatedAt: 0,
})

export const ChatProvider = ({ children }: any) => {
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([])
  const [directMessages, setDirectMessages] = useState<DirectMessages>({})
  const [files, setFiles] = useState<Map<string, ChatFile>>(new Map<string, ChatFile>())
  const [roomId, setRoomId] = useState<Chatroom>('')
  const [historySyncingPeerIds, setHistorySyncingPeerIds] = useState<string[]>([])
  const [networkTotals, setNetworkTotals] = useState<NetworkTotals>(() => buildEmptyStats())
  const messageHistoryRef = useRef<ChatMessage[]>([])
  const directMessagesRef = useRef<DirectMessages>({})
  const requestedHistoryPeers = useRef<Set<string>>(new Set())
  const historyRequestAttempts = useRef(0)
  const historyRetryTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const dmConnectedPeersRef = useRef<Set<string>>(new Set())
  const dmPurgeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const dmPurgeIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const dmPurgeAttempts = useRef<Map<string, number>>(new Map())

  const { libp2p } = useLibp2pContext()
  const textEncoderRef = useRef<TextEncoder>(new TextEncoder())

  const bumpNetworkTotals = useCallback(
    (
      direction: 'sent' | 'received',
      category: NetworkCategory,
      bytes: number,
      cachedBytesDelta = 0,
      cachedFilesDelta = 0,
    ) => {
      if (bytes <= 0) {
        return
      }

      setNetworkTotals((current) => ({
        ...current,
        sentBytes: direction === 'sent' ? current.sentBytes + bytes : current.sentBytes,
        receivedBytes: direction === 'received' ? current.receivedBytes + bytes : current.receivedBytes,
        sentByCategory:
          direction === 'sent'
            ? { ...current.sentByCategory, [category]: (current.sentByCategory[category] ?? 0) + bytes }
            : current.sentByCategory,
        receivedByCategory:
          direction === 'received'
            ? { ...current.receivedByCategory, [category]: (current.receivedByCategory[category] ?? 0) + bytes }
            : current.receivedByCategory,
        cachedBytes: current.cachedBytes + cachedBytesDelta,
        cachedFiles: current.cachedFiles + cachedFilesDelta,
        lastUpdatedAt: Date.now(),
      }))
    },
    [],
  )

  useEffect(() => {
    messageHistoryRef.current = messageHistory
  }, [messageHistory])

  useEffect(() => {
    directMessagesRef.current = directMessages
  }, [directMessages])

  const addSyncingPeer = useCallback((peerId: string) => {
    setHistorySyncingPeerIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]))
  }, [])

  const removeSyncingPeer = useCallback((peerId: string) => {
    setHistorySyncingPeerIds((prev) => prev.filter((p) => p !== peerId))
  }, [])

  const isPeerConnected = useCallback(
    (peerIdStr: string): boolean => {
      try {
        const pid = peerIdFromString(peerIdStr)

        return (libp2p.getConnections?.(pid) ?? []).length > 0
      } catch {
        return false
      }
    },
    [libp2p],
  )

  const mergeHistoryMessages = (incoming: HistorySnapshotMessage[]) => {
    setMessageHistory((prev) => {
      const existingIds = new Set(prev.map((m) => m.msgId))
      const existingSignatures = new Set(prev.map((m) => historySignature(m)))

      const toAdd: ChatMessage[] = incoming
        .filter((m) => !existingIds.has(m.msgId) && !existingSignatures.has(historySignature(m)))
        .map((m) => ({
          msgId: m.msgId,
          msg: m.msg,
          peerId: m.peerId,
          receivedAt: m.receivedAt,
          channel: m.channel ?? 'public',
          fileObjectUrl: undefined,
          read: false,
          status: 'sent',
        }))

      if (toAdd.length === 0) {
        return prev
      }

      const merged = [...prev, ...toAdd].sort((a, b) => a.receivedAt - b.receivedAt)

      return merged
    })
  }

  const mergeDirectHistoryMessages = (peerId: string, incoming: HistorySnapshotMessage[]) => {
    setDirectMessages((prev) => {
      const existing = prev[peerId] ?? []
      const existingIds = new Set(existing.map((m) => m.msgId))
      const existingSignatures = new Set(existing.map((m) => historySignature(m)))

      const toAdd: ChatMessage[] = incoming
        .filter((m) => !existingIds.has(m.msgId) && !existingSignatures.has(historySignature(m)))
        .map((m) => ({
          msgId: m.msgId,
          msg: m.msg,
          peerId: m.peerId,
          receivedAt: m.receivedAt,
          channel: 'dm',
          fileObjectUrl: undefined,
          read: false,
          status: 'sent',
        }))

      if (toAdd.length === 0) {
        return prev
      }

      return {
        ...prev,
        [peerId]: [...existing, ...toAdd].sort((a, b) => a.receivedAt - b.receivedAt),
      }
    })
  }

  const collectHistory = useCallback(
    (scope: 'public' | 'dm', peerId: string | undefined, since: number | undefined, limit: number) => {
      if (scope === 'dm') {
        if (!peerId) return []
        if (!isPeerConnected(peerId)) return []

        return (directMessagesRef.current[peerId] ?? []).filter((m) => (since ? m.receivedAt > since : true))
      }

      return messageHistoryRef.current
        .filter((m) => !m.channel || m.channel === 'public')
        .filter((m) => (since ? m.receivedAt > since : true))
    },
    [isPeerConnected],
  )

  const toHistoryPayload = (scope: 'public' | 'dm', messages: ChatMessage[], limit: number): HistorySnapshotMessage[] =>
    messages.slice(-limit).map((m) => ({
      msgId: m.msgId,
      msg: m.msg,
      peerId: m.peerId,
      receivedAt: m.receivedAt,
      channel: scope === 'dm' ? 'dm' : (m.channel ?? 'public'),
    }))

  const sendHistoryResponseDM = useCallback(
    async (peerId: PeerId, request: HistoryRequest) => {
      const scope = request.scope ?? 'public'
      const limit = request.limit ?? 50
      const since = request.since
      const targetPeer = request.peer ?? request.requester ?? peerId.toString()
      const eligible = collectHistory(scope, scope === 'dm' ? targetPeer : undefined, since, limit)

      if (scope === 'dm' && eligible.length === 0) {
        return
      }

      const payload: HistoryResponse = {
        kind: 'history_response',
        target: request.requester,
        via: 'dm',
        scope,
        peer: scope === 'dm' ? targetPeer : undefined,
        messages: toHistoryPayload(scope, eligible, limit),
      }

      try {
        await libp2p.services.directMessage.send(peerId, JSON.stringify(payload))
      } catch (e) {
        log.error('failed to send history response to %s %o', peerId.toString(), e)
      }
    },
    [collectHistory, libp2p.services.directMessage],
  )

  const sendHistoryResponsePubsub = useCallback(
    async (targetPeerId: string, request: HistoryRequest) => {
      const scope = request.scope ?? 'public'
      const limit = request.limit ?? 50
      const since = request.since
      const eligible = collectHistory(scope, scope === 'dm' ? targetPeerId : undefined, since, limit)

      if (scope === 'dm' && eligible.length === 0) {
        return
      }

      const payload: HistoryResponse = {
        kind: 'history_response',
        target: targetPeerId,
        via: 'pubsub',
        scope,
        peer: scope === 'dm' ? targetPeerId : undefined,
        messages: toHistoryPayload(scope, eligible, limit),
      }

      try {
        const encoded = wrapMeetredMessage(JSON.stringify(payload))

        await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(encoded))
      } catch (e) {
        log.error('failed to publish history response to %s %o', targetPeerId, e)
      }
    },
    [collectHistory, libp2p.services.pubsub],
  )

  const requestHistoryFromPeer = useCallback(
    async (peerId: PeerId, scope: 'public' | 'dm' = 'public') => {
      const id = peerId.toString()
      const requestKey = `${scope}:${id}`

      if (requestedHistoryPeers.current.has(requestKey)) {
        return
      }

      if (scope === 'dm' && !isPeerConnected(id)) {
        return
      }

      requestedHistoryPeers.current.add(requestKey)
      addSyncingPeer(id)

      const payload: HistoryRequest = {
        kind: 'history_request',
        limit: 50,
        requester: libp2p.peerId.toString(),
        via: 'dm',
        scope,
        peer: scope === 'dm' ? libp2p.peerId.toString() : undefined,
      }

      try {
        await libp2p.services.directMessage.send(peerId, JSON.stringify(payload))
      } catch (e) {
        log.error('failed to request history from %s %o', id, e)
        requestedHistoryPeers.current.delete(requestKey)
        removeSyncingPeer(id)
      }
    },
    [addSyncingPeer, isPeerConnected, libp2p.peerId, libp2p.services.directMessage, removeSyncingPeer],
  )

  const broadcastHistoryRequest = useCallback(async () => {
    const payload: HistoryRequest = {
      kind: 'history_request',
      requester: libp2p.peerId.toString(),
      limit: 50,
      via: 'pubsub',
    }

    try {
      const encoded = wrapMeetredMessage(JSON.stringify(payload))

      await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(encoded))
    } catch (e) {
      log.error('failed to broadcast history request %o', e)
    }
  }, [libp2p.peerId, libp2p.services.pubsub])

  const attemptHistoryRequests = useCallback(() => {
    if (messageHistoryRef.current.length > 0) {
      return true
    }

    historyRequestAttempts.current += 1

    void broadcastHistoryRequest()

    const conns = libp2p.getConnections?.() ?? []

    conns.forEach((conn: any) => {
      if (conn?.remotePeer) {
        void requestHistoryFromPeer(conn.remotePeer as PeerId, 'public')
      }
    })

    return historyRequestAttempts.current >= 3
  }, [broadcastHistoryRequest, libp2p, requestHistoryFromPeer])

  const handleHistoryControl = useCallback(
    async (control: HistoryControlMessage, senderPeerId?: PeerId | string) => {
      const selfId = libp2p.peerId.toString()
      const senderId = typeof senderPeerId === 'string' ? senderPeerId : senderPeerId?.toString()

      if (control.kind === 'history_request') {
        const requester =
          control.requester ?? (typeof senderPeerId === 'string' ? senderPeerId : senderPeerId?.toString())

        if (!requester || requester === selfId) {
          return
        }

        if (control.scope === 'dm' && senderId && !isPeerConnected(senderId)) {
          return
        }

        if (control.via === 'pubsub') {
          await sendHistoryResponsePubsub(requester, control)
        } else if (senderPeerId && typeof senderPeerId !== 'string') {
          await sendHistoryResponseDM(senderPeerId, control)
        } else {
          await sendHistoryResponsePubsub(requester, control)
        }

        return
      }

      if (control.kind === 'history_response') {
        if (control.target && control.target !== selfId) {
          return
        }

        if (senderId) {
          removeSyncingPeer(senderId)
        }

        if (control.scope === 'dm' && senderId) {
          if (!isPeerConnected(senderId)) {
            return
          }

          mergeDirectHistoryMessages(senderId, control.messages)
        } else {
          mergeHistoryMessages(control.messages)
        }
      }
    },
    [
      libp2p.peerId,
      mergeDirectHistoryMessages,
      mergeHistoryMessages,
      removeSyncingPeer,
      sendHistoryResponseDM,
      sendHistoryResponsePubsub,
    ],
  )

  const messageCB = (evt: CustomEvent<Message>) => {
    // FIXME: Why does 'from' not exist on type 'Message'?
    const { topic, data } = evt.detail
    const detail = evt.detail
    const raw = new TextDecoder().decode(data)

    if (detail.type === 'signed' && hasFromPeer(detail)) {
      let category: NetworkCategory = 'pubsub-chat'

      if (topic === CHAT_FILE_TOPIC) {
        category = 'pubsub-file-meta'
      } else if (topic === PUBSUB_PEER_DISCOVERY) {
        return
      } else if (topic === CHAT_TOPIC && isStreamSignal(raw)) {
        category = 'pubsub-signal'
      }

      bumpNetworkTotals('received', category, data.length)
    }

    switch (topic) {
      case CHAT_TOPIC:
      case STREAM_CHAT_TOPIC:
      case AGENT_CHAT_TOPIC: {
        chatMessageCB(evt, topic, data)
        break
      }
      case CHAT_FILE_TOPIC: {
        chatFileMessageCB(evt, topic, data)
        break
      }
      case PUBSUB_PEER_DISCOVERY: {
        break
      }
      default: {
        log.error(`Unexpected event %o on gossipsub topic: ${topic}`, evt)
      }
    }
  }

  const chatMessageCB = (evt: CustomEvent<Message>, topic: string, data: Uint8Array) => {
    const raw = new TextDecoder().decode(data)

    if (topic === CHAT_TOPIC && isStreamSignal(raw)) {
      return
    }

    let parsedMessage: string | null = null
    let channel: ChatMessage['channel'] = 'public'

    const decodedRaw = decodeZeroWidth(raw) ?? raw
    const control = parseHistoryControlMessage(decodedRaw)

    if (control) {
      if (evt.detail.type === 'signed' && hasFromPeer(evt.detail)) {
        void handleHistoryControl(control, evt.detail.from)
      }

      return
    }

    if (topic === CHAT_TOPIC) {
      // stream/agent chats can also ride on the shared topic; try them first
      const streamPayload = parseStreamChatPayload(decodedRaw)

      if (streamPayload) {
        parsedMessage = JSON.stringify(streamPayload)
        channel = 'stream'
      }

      if (!parsedMessage) {
        const agentPayload = parseAgentChatPayload(decodedRaw)

        if (agentPayload) {
          parsedMessage = JSON.stringify(agentPayload)
          channel = 'agent'
        }
      }

      if (!parsedMessage) {
        parsedMessage = unwrapPublicMessage(raw)
        if (!parsedMessage) {
          return
        }
      }
    } else if (topic === STREAM_CHAT_TOPIC) {
      const payload = parseStreamChatPayload(decodedRaw)

      if (!payload) {
        return
      }

      parsedMessage = JSON.stringify(payload)
      channel = 'stream'
    } else if (topic === AGENT_CHAT_TOPIC) {
      const payload = parseAgentChatPayload(decodedRaw)

      if (!payload) {
        return
      }

      parsedMessage = JSON.stringify(payload)
      channel = 'agent'
    } else {
      return
    }

    if (parsedMessage) {
      const controlFromParsed = parseHistoryControlMessage(parsedMessage)

      if (controlFromParsed) {
        if (evt.detail.type === 'signed' && hasFromPeer(evt.detail)) {
          void handleHistoryControl(controlFromParsed, evt.detail.from)
        }

        return
      }
    }

    const detail = evt.detail
    const msg = parsedMessage

    // Append signed messages, otherwise discard
    if (detail.type === 'signed' && hasFromPeer(detail)) {
      setMessageHistory((prev) => [
        ...prev,
        {
          msgId: crypto.randomUUID(),
          msg,
          fileObjectUrl: undefined,
          peerId: detail.from.toString(),
          read: false,
          receivedAt: Date.now(),
          status: 'sent',
          channel,
        },
      ])
    }
  }

  const chatFileMessageCB = async (evt: CustomEvent<Message>, topic: string, data: Uint8Array) => {
    const newChatFileMessage = (id: string, body: Uint8Array, name?: string) => {
      return `File: ${name ?? id} (${body.length} bytes)`
    }
    const decoded = new TextDecoder().decode(data)

    const detail = evt.detail

    // if the message isn't signed, discard it.
    if (detail.type !== 'signed' || !hasFromPeer(detail)) {
      return
    }
    const senderPeerId = detail.from

    try {
      let meta: { id: string; name?: string; type?: string } = { id: decoded }

      try {
        meta = JSON.parse(decoded)
      } catch {
        // ignore JSON parse errors; fall back to raw id
      }

      const stream = await libp2p.dialProtocol(senderPeerId, FILE_EXCHANGE_PROTOCOL)

      await pipe(
        [uint8ArrayFromString(meta.id)],
        (source) => lp.encode(source),
        stream as any,
        (source) => lp.decode(source),
        async function (source) {
          for await (const data of source) {
            const body: Uint8Array = data.subarray()

            log(`chat file message request_response: response received: size:${body.length}`)

            const msg: ChatMessage = {
              msgId: crypto.randomUUID(),
              msg: newChatFileMessage(meta.id, body, meta.name),
              fileName: meta.name ?? `file-${meta.id}`,
              fileType: meta.type,
              fileObjectUrl: window.URL.createObjectURL(
                new Blob([body as any], { type: meta.type || 'application/octet-stream' }),
              ),
              peerId: senderPeerId.toString(),
              read: false,
              receivedAt: Date.now(),
              channel: 'public',
            }

            bumpNetworkTotals('received', 'file-transfer', body.length, body.length, 1)
            setMessageHistory((prev) => [...prev, { ...msg, status: 'sent' }])
          }
        },
      )
    } catch (e) {
      log.error('Failed to process chat file message %o', e)
    }
  }

  useEffect(() => {
    const handleDirectMessage = (evt: CustomEvent<DirectMessageEvent>) => {
      const peer = evt.detail.connection.remotePeer
      const peerId = peer.toString()

      if (evt.detail.type !== MIME_TEXT_PLAIN) {
        throw new Error(`unexpected message type: ${evt.detail.type}`)
      }

      const control = parseHistoryControlMessage(evt.detail.content)

      if (control) {
        void handleHistoryControl(control, peer)

        return
      }

      if (isStreamSignal(evt.detail.content)) {
        return
      }

      const message: ChatMessage = {
        msg: evt.detail.content,
        read: false,
        msgId: crypto.randomUUID(),
        fileObjectUrl: undefined,
        peerId: peerId,
        receivedAt: Date.now(),
        channel: 'dm',
      }

      const messageWithStatus: ChatMessage = { ...message, status: 'sent' }

      const incomingBytes = textEncoderRef.current.encode(evt.detail.content).length
      bumpNetworkTotals('received', 'dm', incomingBytes)
      setDirectMessages((prev) => {
        const existing = prev[peerId] ?? []

        return {
          ...prev,
          [peerId]: [...existing, messageWithStatus],
        }
      })
    }

    libp2p.services.directMessage.addEventListener(directMessageEvent, handleDirectMessage)

    return () => {
      libp2p.services.directMessage.removeEventListener(directMessageEvent, handleDirectMessage)
    }
  }, [handleHistoryControl, libp2p.services.directMessage, setDirectMessages])

  useEffect(() => {
    const handlePeerConnect = ({ detail }: any) => {
      const peerId: PeerId | undefined = detail?.remotePeer ?? detail

      if (peerId) {
        void requestHistoryFromPeer(peerId, 'public')
      }
    }

    const existingConnections = libp2p.getConnections?.() ?? []

    existingConnections.forEach((conn: any) => {
      if (conn?.remotePeer) {
        void requestHistoryFromPeer(conn.remotePeer as PeerId, 'public')
      }
    })

    libp2p.addEventListener('peer:connect', handlePeerConnect)

    return () => {
      libp2p.removeEventListener('peer:connect', handlePeerConnect)
    }
  }, [libp2p, requestHistoryFromPeer])

  useEffect(() => {
    const maxAttempts = 3
    const intervalMs = 4_000

    if (messageHistory.length > 0) {
      historyRequestAttempts.current = 0

      if (historyRetryTimer.current) {
        clearInterval(historyRetryTimer.current)
        historyRetryTimer.current = null
      }

      setHistorySyncingPeerIds([])

      return
    }

    const stopAfterFirst = attemptHistoryRequests()

    if (stopAfterFirst) {
      return
    }

    const timer = setInterval(() => {
      if (messageHistoryRef.current.length > 0) {
        clearInterval(timer)
        historyRetryTimer.current = null
        setHistorySyncingPeerIds([])

        return
      }

      if (historyRequestAttempts.current >= maxAttempts) {
        clearInterval(timer)
        historyRetryTimer.current = null
        setHistorySyncingPeerIds([])

        return
      }

      const stop = attemptHistoryRequests()

      if (stop) {
        clearInterval(timer)
        historyRetryTimer.current = null
      }
    }, intervalMs)

    historyRetryTimer.current = timer

    return () => {
      clearInterval(timer)
      historyRetryTimer.current = null
    }
  }, [attemptHistoryRequests, messageHistory.length])

  useEffect(() => {
    if (!roomId) {
      return
    }

    const existing = directMessagesRef.current[roomId] ?? []

    if (existing.length > 0) {
      return
    }

    try {
      const peer = peerIdFromString(roomId)

      void requestHistoryFromPeer(peer, 'dm')
    } catch {
      // ignore invalid peer ids
    }
  }, [requestHistoryFromPeer, roomId])

  useEffect(() => {
    const handleConnectionOpen = ({ detail }: any) => {
      const peer = detail?.remotePeer ?? detail

      if (!peer) return

      dmConnectedPeersRef.current.add(peer.toString())
      const id = peer.toString()
      const existingTimer = dmPurgeTimers.current.get(id)

      if (existingTimer) {
        clearTimeout(existingTimer)
        dmPurgeTimers.current.delete(id)
      }
      const existingInterval = dmPurgeIntervals.current.get(id)

      if (existingInterval) {
        clearInterval(existingInterval)
        dmPurgeIntervals.current.delete(id)
      }
      dmPurgeAttempts.current.delete(id)
    }

    const handleConnectionClose = ({ detail }: any) => {
      const peer = detail?.remotePeer ?? detail

      if (!peer) return

      const peerIdStr = peer.toString()

      dmConnectedPeersRef.current.delete(peerIdStr)
      const intervalMs = 30_000
      const maxAttempts = 3

      const scheduleCheck = () => {
        const attempt = (dmPurgeAttempts.current.get(peerIdStr) ?? 0) + 1

        dmPurgeAttempts.current.set(peerIdStr, attempt)

        const stillConnected = isPeerConnected(peerIdStr)

        if (stillConnected) {
          const int = dmPurgeIntervals.current.get(peerIdStr)

          if (int) clearInterval(int)
          dmPurgeIntervals.current.delete(peerIdStr)
          dmPurgeAttempts.current.delete(peerIdStr)

          return
        }

        if (attempt >= maxAttempts) {
          setDirectMessages((prev) => {
            const next = { ...prev }

            delete next[peerIdStr]

            return next
          })

          const int = dmPurgeIntervals.current.get(peerIdStr)

          if (int) clearInterval(int)
          dmPurgeIntervals.current.delete(peerIdStr)
          dmPurgeAttempts.current.delete(peerIdStr)
        }
      }

      // Start periodic checks; first check after interval to allow reconnects
      const intervalId = setInterval(scheduleCheck, intervalMs)

      dmPurgeIntervals.current.set(peerIdStr, intervalId)

      // Also set a longstop timeout to ensure interval is cleared eventually
      const purgeTimer = setTimeout(
        () => {
          const int = dmPurgeIntervals.current.get(peerIdStr)

          if (int) clearInterval(int)
          dmPurgeIntervals.current.delete(peerIdStr)
          dmPurgeAttempts.current.delete(peerIdStr)
          dmPurgeTimers.current.delete(peerIdStr)
        },
        intervalMs * maxAttempts + 5_000,
      )

      dmPurgeTimers.current.set(peerIdStr, purgeTimer)
    }

    libp2p.addEventListener('connection:open', handleConnectionOpen)
    libp2p.addEventListener('connection:close', handleConnectionClose)

    return () => {
      libp2p.removeEventListener('connection:open', handleConnectionOpen)
      libp2p.removeEventListener('connection:close', handleConnectionClose)
      dmPurgeTimers.current.forEach((timer) => clearTimeout(timer))
      dmPurgeTimers.current.clear()
      dmPurgeIntervals.current.forEach((interval) => clearInterval(interval))
      dmPurgeIntervals.current.clear()
      dmPurgeAttempts.current.clear()
    }
  }, [isPeerConnected, libp2p, setDirectMessages])

  useEffect(() => {
    libp2p.services.pubsub.addEventListener('message', messageCB)

    libp2p.handle(FILE_EXCHANGE_PROTOCOL, ({ stream }: any) => {
      pipe(
        stream.source,
        (source) => lp.decode(source),
        (source) =>
          map(source, async (msg) => {
            const fileId = uint8ArrayToString(msg.subarray())
            const file = files.get(fileId)

            if (!file) {
              log.error('requested file not found %s', fileId)

              return new Uint8Array(0)
            }

            bumpNetworkTotals('sent', 'file-transfer', file.body.length)
            return file.body
          }),
        (source) => lp.encode(source),
        stream.sink,
      )
    })

    return () => {
      ;(async () => {
        // Cleanup handlers 👇
        libp2p.services.pubsub.removeEventListener('message', messageCB)
        await libp2p.unhandle(FILE_EXCHANGE_PROTOCOL)
      })()
    }
  })

  return (
    <ChatContext.Provider
      value={{
        roomId,
        setRoomId,
        messageHistory,
        setMessageHistory,
        directMessages,
        setDirectMessages,
        files,
        setFiles,
        historySyncingPeerIds,
        networkTotals,
        recordNetworkUsage: bumpNetworkTotals,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
