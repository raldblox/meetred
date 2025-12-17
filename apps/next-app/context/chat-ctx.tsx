'use client'

import type { PeerId, Message } from '@libp2p/interface'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { pipe } from 'it-pipe'
import map from 'it-map'
import * as lp from 'it-length-prefixed'

import { useLibp2pContext } from './libp2p-ctx'

import {
  CHAT_FILE_TOPIC,
  CHAT_TOPIC,
  FILE_EXCHANGE_PROTOCOL,
  MIME_TEXT_PLAIN,
  PUBSUB_PEER_DISCOVERY,
  STREAM_SIGNAL_APP_ID,
  STREAM_SIGNAL_WRAPPER,
} from '@/config/constants'
import { forComponent } from '@/lib/logger'
import { DirectMessageEvent, directMessageEvent } from '@/lib/direct-message'

const log = forComponent('chat-context')

const isStreamSignal = (content: string) => {
  try {
    const parsed = JSON.parse(content)

    return parsed?.type === STREAM_SIGNAL_WRAPPER && parsed?.app === STREAM_SIGNAL_APP_ID
  } catch {
    return false
  }
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

export interface ChatContextInterface {
  messageHistory: ChatMessage[]
  setMessageHistory: (messageHistory: ChatMessage[] | ((prevMessages: ChatMessage[]) => ChatMessage[])) => void
  directMessages: DirectMessages
  setDirectMessages: (directMessages: DirectMessages | ((prevMessages: DirectMessages) => DirectMessages)) => void
  roomId: Chatroom
  setRoomId: (chatRoom: Chatroom) => void
  files: Map<string, ChatFile>
  setFiles: (files: Map<string, ChatFile>) => void
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
})

export const useChatContext = () => {
  return useContext(ChatContext)
}

export const ChatProvider = ({ children }: any) => {
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([])
  const [directMessages, setDirectMessages] = useState<DirectMessages>({})
  const [files, setFiles] = useState<Map<string, ChatFile>>(new Map<string, ChatFile>())
  const [roomId, setRoomId] = useState<Chatroom>('')

  const { libp2p } = useLibp2pContext()

  const messageCB = (evt: CustomEvent<Message>) => {
    // FIXME: Why does 'from' not exist on type 'Message'?
    const { topic, data } = evt.detail

    switch (topic) {
      case CHAT_TOPIC: {
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
    const msg = new TextDecoder().decode(data)

    if (isStreamSignal(msg)) {
      return
    }

    log(`${topic}: ${msg}`)

    // Append signed messages, otherwise discard
    if (evt.detail.type === 'signed') {
      setMessageHistory((prev) => [
        ...prev,
        {
          msgId: crypto.randomUUID(),
          msg,
          fileObjectUrl: undefined,
          peerId: evt.detail.from.toString(),
          read: false,
          receivedAt: Date.now(),
          status: 'sent',
        },
      ])
    }
  }

  const chatFileMessageCB = async (evt: CustomEvent<Message>, topic: string, data: Uint8Array) => {
    const newChatFileMessage = (id: string, body: Uint8Array, name?: string) => {
      return `File: ${name ?? id} (${body.length} bytes)`
    }
    const decoded = new TextDecoder().decode(data)

    // if the message isn't signed, discard it.
    if (evt.detail.type !== 'signed') {
      return
    }
    const senderPeerId = evt.detail.from as any as PeerId

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
            }

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
      const peerId = evt.detail.connection.remotePeer.toString()

      if (evt.detail.type !== MIME_TEXT_PLAIN) {
        throw new Error(`unexpected message type: ${evt.detail.type}`)
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
      }

      const messageWithStatus: ChatMessage = { ...message, status: 'sent' }

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
  }, [libp2p.services.directMessage, setDirectMessages])

  useEffect(() => {
    libp2p.services.pubsub.addEventListener('message', messageCB)

    libp2p.handle(FILE_EXCHANGE_PROTOCOL, ({ stream }) => {
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
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}
