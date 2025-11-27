'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Blockies from 'react-18-blockies'
import { peerIdFromString } from '@libp2p/peer-id'
import { Button, Input, Spinner, Textarea } from '@heroui/react'
import { ChevronLeftIcon, Earth, SendIcon, UploadIcon, UsersIcon, X } from 'lucide-react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { ChatFile, ChatMessage, useChatContext } from '../context/chat-ctx'

import { ChatPeerList } from './chat-peer-list'
import { Message } from './message'

import { forComponent } from '@/lib/logger'
import { CHAT_FILE_TOPIC, CHAT_TOPIC } from '@/lib/constants'
import { useLibp2pContext } from '@/context/libp2p-ctx'

const log = forComponent('chat')

export const PUBLIC_CHAT_ROOM_ID = ''
const PUBLIC_CHAT_ROOM_NAME = 'Public Room'

export default function ChatContainer() {
  const { libp2p } = useLibp2pContext()
  const { roomId, setRoomId } = useChatContext()
  const { messageHistory, setMessageHistory, directMessages, setDirectMessages, files, setFiles } = useChatContext()
  const [input, setInput] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [showMobilePeerList, setShowMobilePeerList] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Send message to public chat over gossipsub
  const sendPublicMessage = useCallback(async () => {
    const trimmedMessage = input.trim()

    if (trimmedMessage === '') return

    log(`peers in gossip for topic ${CHAT_TOPIC}:`, libp2p.services.pubsub.getSubscribers(CHAT_TOPIC).toString())

    const res = await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(trimmedMessage))

    log(
      'sent message to: ',
      res.recipients.map((peerId) => peerId.toString()),
    )

    const myPeerId = libp2p.peerId.toString()

    setMessageHistory([
      ...messageHistory,
      {
        msgId: crypto.randomUUID(),
        msg: trimmedMessage,
        fileObjectUrl: undefined,
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
      },
    ])

    setInput('')
  }, [input, messageHistory, setInput, libp2p, setMessageHistory])

  // Send direct message over custom protocol
  const sendDirectMessage = useCallback(async () => {
    const trimmedMessage = input.trim()

    if (trimmedMessage === '') return
    try {
      const res = await libp2p.services.directMessage.send(peerIdFromString(roomId), trimmedMessage)

      if (!res) {
        log('Failed to send message')

        return
      }

      const myPeerId = libp2p.peerId.toString()

      const newMessage: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: trimmedMessage,
        fileObjectUrl: undefined,
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
      }

      const updatedMessages = directMessages[roomId] ? [...directMessages[roomId], newMessage] : [newMessage]

      setDirectMessages({
        ...directMessages,
        [roomId]: updatedMessages,
      })

      setInput('')
    } catch (e: any) {
      log(e)
    }
  }, [libp2p, setDirectMessages, directMessages, roomId, input])

  const sendFile = useCallback(
    async (readerEvent: ProgressEvent<FileReader>, fileName?: string, fileType?: string) => {
      const fileBody = readerEvent.target?.result as ArrayBuffer

      const myPeerId = libp2p.peerId.toString()
      const file: ChatFile = {
        id: uuidv4(),
        body: new Uint8Array(fileBody),
        sender: myPeerId,
        name: fileName,
        type: fileType,
      }

      setFiles(files.set(file.id, file))

      log(
        `peers in gossip for topic ${CHAT_FILE_TOPIC}:`,
        libp2p.services.pubsub.getSubscribers(CHAT_FILE_TOPIC).toString(),
      )

      const payload = JSON.stringify({ id: file.id, name: file.name, type: file.type })
      const res = await libp2p.services.pubsub.publish(CHAT_FILE_TOPIC, new TextEncoder().encode(payload))

      log(
        'sent file to: ',
        res.recipients.map((peerId) => peerId.toString()),
      )

      const msg: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: newChatFileMessage(file.id, file.body, file.name),
        fileName: file.name ?? `file-${file.id}`,
        fileType: file.type,
        fileObjectUrl: window.URL.createObjectURL(new Blob([file.body as any], { type: file.type || undefined })),
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
      }

      setMessageHistory([...messageHistory, msg])
    },
    [messageHistory, libp2p, setMessageHistory, files, setFiles],
  )

  const newChatFileMessage = (id: string, body: Uint8Array, name?: string) => {
    return `File: ${name ?? id} (${body.length} bytes)`
  }

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) {
        return
      }

      e.preventDefault()

      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        await sendPublicMessage()
      } else {
        await sendDirectMessage()
      }
    },
    [sendPublicMessage, sendDirectMessage, roomId],
  )

  const handleSend = useCallback(async () => {
    if (sending) return

    setSending(true)
    try {
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        await sendPublicMessage()
      } else {
        await sendDirectMessage()
      }
    } finally {
      setSending(false)
    }
  }, [roomId, sendDirectMessage, sendPublicMessage, sending])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const reader = new FileReader()

        const selected = e.target.files[0]

        reader.readAsArrayBuffer(selected)
        reader.onload = (readerEvent) => {
          sendFile(readerEvent, selected.name, selected.type)
        }
      }
    },
    [sendFile],
  )

  const handleFileSend = useCallback(() => {
    fileRef?.current?.click()
  }, [])

  const handleBackToPublic = () => {
    setRoomId(PUBLIC_CHAT_ROOM_ID)
    setMessages(messageHistory)
  }

  const toggleMobilePeerList = () => {
    setShowMobilePeerList(!showMobilePeerList)
  }

  useEffect(() => {
    // assumes a chat room is a peerId thus a direct message
    if (roomId === PUBLIC_CHAT_ROOM_ID) {
      setMessages(messageHistory)
    } else {
      setMessages(directMessages[roomId] || [])
    }
  }, [roomId, directMessages, messageHistory])

  useEffect(() => {
    const invitePeer = searchParams?.get('invite')

    if (!invitePeer) {
      return
    }

    if (invitePeer === roomId) {
      router.replace(pathname, { scroll: false })

      return
    }

    setRoomId(invitePeer)
    router.replace(pathname, { scroll: false })
  }, [pathname, router, roomId, searchParams, setRoomId])

  useEffect(() => {
    if (!roomId || roomId === PUBLIC_CHAT_ROOM_ID) {
      return
    }

    try {
      const peer = peerIdFromString(roomId)

      libp2p.dial(peer).catch(() => {})
    } catch {}
  }, [libp2p, roomId])

  return (
    <div className="w-full relative border-x border-default-100 mx-auto container h-full min-h-0 grid grid-cols-1 lg:grid-cols-6">
      <div className="hidden h-full lg:block border-r border-default-100">
        <ChatPeerList />
      </div>
      <div
        className={`col-span-1 lg:col-span-5 flex flex-col min-h-0 h-full overflow-hidden ${
          roomId !== PUBLIC_CHAT_ROOM_ID ? 'bg-default-100/20' : ''
        }`}
      >
        <div
          className={`relative h-10 flex items-center text-sm font-semibold py-2 px-3 border-b border-default-100 text-default-800`}
        >
          {roomId === PUBLIC_CHAT_ROOM_ID && (
            <>
              <span className="flex font-bold items-center gap-2">
                <Earth className="h-7" />
                {PUBLIC_CHAT_ROOM_NAME}
              </span>
              <button
                aria-label="Toggle peer list"
                className="ml-auto lg:hidden flex items-center text-default-500 hover:text-default-700"
                onClick={toggleMobilePeerList}
              >
                <UsersIcon className="h-4 w-4" />
                <span className="ml-1 text-sm ">Peers</span>
              </button>
            </>
          )}
          {roomId !== PUBLIC_CHAT_ROOM_ID && (
            <>
              <Blockies className="rounded mr-2 h-6" scale={3} seed={roomId} size={12} />
              <span className="text-default-500 uppercase flex">{roomId.toString().slice(-7)}</span>
              <div className="flex items-center ml-auto gap-1">
                <Button
                  aria-label="Toggle peer list"
                  className="lg:hidden flex items-center"
                  size="sm"
                  variant="flat"
                  onPress={toggleMobilePeerList}
                >
                  <UsersIcon className="h-5 w-5" />
                  <span className="ml-1 text-sm">Peers</span>
                </Button>
                <Button
                  className="text-default-500 h-7 flex items-center"
                  size="sm"
                  variant="flat"
                  onPress={handleBackToPublic}
                >
                  <ChevronLeftIcon className="w-4 h-4 text-default-500" />
                  <span className="hidden text-sm sm:inline">Back to Public Chat</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
            </>
          )}
        </div>
        {showMobilePeerList && (
          <div className="lg:hidden border border-default-100 m-2">
            <div className="flex h-10 bg-default-100 items-center justify-between pl-3 pr-1">
              <h2 className="text-sm text-default-600 flex items-center gap-1">
                <UsersIcon className="h-4 w-4" />
                Peers
              </h2>
              <Button
                isIconOnly
                aria-label="Close peer list"
                className="h-7"
                color="danger"
                size="sm"
                variant="light"
                onPress={toggleMobilePeerList}
              >
                <X size={16} />
              </Button>
            </div>
            <ChatPeerList hideHeader={true} />
          </div>
        )}

        <div className={`flex flex-col min-h-0 flex-1 `}>
          <ul className={`p-3 space-y-1 overflow-y-auto flex-1 min-h-0 `}>
            {messages.map((message: ChatMessage, index: number) => {
              const previousMessage = index > 0 ? messages[index - 1] : undefined
              const sameSender = previousMessage ? previousMessage.peerId === message.peerId : false
              const withinTwoMinutes = previousMessage
                ? message.receivedAt - previousMessage.receivedAt <= 2 * 60 * 1000
                : false
              const showTimestamp = !previousMessage || !sameSender || !withinTwoMinutes

              const showAvatar = !previousMessage || !sameSender

              return (
                <Message
                  key={message.msgId}
                  dm={roomId !== ''}
                  fileObjectUrl={message.fileObjectUrl}
                  msg={message.msg}
                  msgId={message.msgId}
                  peerId={message.peerId}
                  read={message.read}
                  receivedAt={message.receivedAt}
                  showAvatar={showAvatar}
                  showTimestamp={showTimestamp}
                />
              )
            })}
          </ul>
          <div className="w-full h-fit p-2">
            <div className="flex rounded-xl bg-default-100 p-2 items-end justify-between w-full">
              <Input
                ref={fileRef}
                className="hidden"
                disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                type="file"
                onChange={handleFileInput}
              />
              <Button
                isIconOnly
                className={`${roomId === PUBLIC_CHAT_ROOM_ID ? '' : 'cursor-not-allowed'} border-1 border-default-100 p-0`}
                disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                title={roomId === PUBLIC_CHAT_ROOM_ID ? 'Upload file' : "Unsupported in DM's"}
                variant="ghost"
                onPress={handleFileSend}
              >
                <UploadIcon size={16} />
              </Button>

              <Textarea
                classNames={{ inputWrapper: '!bg-transparent' }}
                minRows={1}
                name="message"
                placeholder="Message"
                type="text"
                value={input}
                variant="flat"
                onChange={handleInput}
                onKeyDown={handleKeyDown}
              />
              <Button
                isIconOnly
                className="border-1 border-default-100"
                color={input ? 'primary' : 'default'}
                isDisabled={sending}
                type="submit"
                variant="solid"
                onPress={handleSend}
              >
                {sending ? <Spinner size="sm" /> : <SendIcon size={16} />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
