'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Blockies from 'react-18-blockies'
import { peerIdFromString } from '@libp2p/peer-id'
import { Button, Input, Spinner, Textarea, Tooltip, ScrollShadow } from '@heroui/react'
import { ChevronLeftIcon, Earth, SendIcon, Share, UsersIcon, Cast, Video, X, ChevronDown, Bot } from 'lucide-react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { ChatFile, ChatMessage, useChatContext } from '../../context/chat-ctx'

import { ChatPeerList } from './chat-peer-list'
import { Message } from './message'

import { forComponent } from '@/lib/logger'
import { CHAT_FILE_TOPIC, CHAT_TOPIC } from '@/config/constants'
import { PUBLIC_ROOM_COPY, UI_COPY } from '@/config/copy'
import { wrapMeteredMessage } from '@/lib/metered-envelope'
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
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [showMobilePeerList, setShowMobilePeerList] = useState(false)
  const [isMessageListAtBottom, setIsMessageListAtBottom] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const composerPlaceholder = roomId === PUBLIC_CHAT_ROOM_ID ? PUBLIC_ROOM_COPY.composer.placeholder : 'Message'

  // Send message to public chat over gossipsub
  const sendPublicMessage = useCallback(
    async (rawMessage: string) => {
      const trimmedMessage = rawMessage.trim()

      if (trimmedMessage === '') return

      log(`peers in gossip for topic ${CHAT_TOPIC}:`, libp2p.services.pubsub.getSubscribers(CHAT_TOPIC).toString())

      const myPeerId = libp2p.peerId.toString()
      const pendingMessage: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: trimmedMessage,
        fileObjectUrl: undefined,
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
        status: 'pending',
        channel: 'public',
      }

      setMessageHistory((prev) => [...prev, pendingMessage])

      try {
        const envelope = wrapMeteredMessage(trimmedMessage)
        const res = await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(envelope))

        log(
          'sent message to: ',
          res.recipients.map((peerId) => peerId.toString()),
        )

        setMessageHistory((prev) =>
          prev.map((message) => (message.msgId === pendingMessage.msgId ? { ...message, status: 'sent' } : message)),
        )
      } catch (error) {
        log.error('failed to send public message %o', error)
        setMessageHistory((prev) =>
          prev.map((message) => (message.msgId === pendingMessage.msgId ? { ...message, status: 'failed' } : message)),
        )
        throw error
      }
    },
    [libp2p, setMessageHistory],
  )

  // Send direct message over custom protocol
  const sendDirectMessage = useCallback(
    async (rawMessage: string) => {
      const trimmedMessage = rawMessage.trim()

      if (trimmedMessage === '') return

      const targetRoomId = roomId
      const myPeerId = libp2p.peerId.toString()
      const pendingMessage: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: trimmedMessage,
        fileObjectUrl: undefined,
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
        status: 'pending',
      }

      setDirectMessages((prev) => {
        const existing = prev[targetRoomId] ?? []

        return {
          ...prev,
          [targetRoomId]: [...existing, pendingMessage],
        }
      })

      try {
        const res = await libp2p.services.directMessage.send(peerIdFromString(targetRoomId), trimmedMessage)

        if (!res) {
          throw new Error('Failed to send message')
        }

        setDirectMessages((prev) => {
          const existing = prev[targetRoomId]

          if (!existing) {
            return prev
          }

          return {
            ...prev,
            [targetRoomId]: existing.map((message) =>
              message.msgId === pendingMessage.msgId ? { ...message, status: 'sent' } : message,
            ),
          }
        })
      } catch (error) {
        log.error('failed to send direct message %o', error)
        setDirectMessages((prev) => {
          const existing = prev[targetRoomId]

          if (!existing) {
            return prev
          }

          return {
            ...prev,
            [targetRoomId]: existing.map((message) =>
              message.msgId === pendingMessage.msgId ? { ...message, status: 'failed' } : message,
            ),
          }
        })

        throw error
      }
    },
    [libp2p, roomId, setDirectMessages],
  )

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
        status: 'sent',
        channel: 'public',
      }

      setMessageHistory((prev) => [...prev, msg])
    },
    [libp2p, setMessageHistory, files, setFiles],
  )

  const newChatFileMessage = (id: string, body: Uint8Array, name?: string) => {
    return `File: ${name ?? id} (${body.length} bytes)`
  }

  const handleSend = useCallback(async () => {
    if (sending) return

    const trimmedMessage = input.trim()

    if (!trimmedMessage) return

    setSending(true)
    try {
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        await sendPublicMessage(trimmedMessage)
      } else {
        await sendDirectMessage(trimmedMessage)
      }
      setInput('')
    } catch (error) {
      log.error('failed to send message %o', error)
    } finally {
      setSending(false)
    }
  }, [input, roomId, sendDirectMessage, sendPublicMessage, sending])

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Enter' || e.shiftKey) {
        return
      }

      e.preventDefault()
      await handleSend()
    },
    [handleSend],
  )

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

  const handleSendMeetingInvite = useCallback(async () => {
    if (sending) return

    const hostPeerId = libp2p.peerId.toString()
    const meetingInvite = JSON.stringify({
      type: 'meeting_invite',
      roomId: hostPeerId,
      hostPeerId,
      createdAt: Date.now(),
    })

    setSending(true)
    try {
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        await sendPublicMessage(meetingInvite)
      } else {
        await sendDirectMessage(meetingInvite)
      }
    } catch (error) {
      log.error('failed to send meeting invite %o', error)
    } finally {
      setSending(false)
    }
  }, [libp2p, roomId, sendDirectMessage, sendPublicMessage, sending])

  const handleSendStreamInvite = useCallback(async () => {
    if (sending) return

    const hostPeerId = libp2p.peerId.toString()
    // const hostAddrs = libp2p.getMultiaddrs?.().map((ma) => ma.toString()) ?? []
    const streamInvite = JSON.stringify({
      type: 'stream_invite',
      streamId: hostPeerId,
      hostPeerId,
      // multiaddrs: hostAddrs,
      createdAt: Date.now(),
    })

    setSending(true)
    try {
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        await sendPublicMessage(streamInvite)
      } else {
        await sendDirectMessage(streamInvite)
      }
    } catch (error) {
      log.error('failed to send stream invite %o', error)
    } finally {
      setSending(false)
    }
  }, [libp2p, roomId, sendDirectMessage, sendPublicMessage, sending])

  const handleSendAgentInvite = useCallback(async () => {
    if (sending) return

    const hostPeerId = libp2p.peerId.toString()
    const agentInvite = JSON.stringify({
      type: 'agent_invite',
      agentPeerId: hostPeerId,
      createdAt: Date.now(),
    })

    setSending(true)
    try {
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        await sendPublicMessage(agentInvite)
      } else {
        await sendDirectMessage(agentInvite)
      }
    } catch (error) {
      log.error('failed to send agent invite %o', error)
    } finally {
      setSending(false)
    }
  }, [libp2p, roomId, sendDirectMessage, sendPublicMessage, sending])

  const handleBackToPublic = () => {
    setRoomId(PUBLIC_CHAT_ROOM_ID)
    setMessages(messageHistory.filter((msg) => !msg.channel || msg.channel === 'public'))
  }

  const toggleMobilePeerList = () => {
    setShowMobilePeerList(!showMobilePeerList)
  }

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const list = messageListRef.current

    if (!list) {
      return
    }

    list.scrollTo({ top: list.scrollHeight, behavior })
  }, [])

  const handleMessageScroll = useCallback(() => {
    const list = messageListRef.current

    if (!list) {
      return
    }

    const threshold = 64
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= threshold

    setIsMessageListAtBottom((prev) => (prev === atBottom ? prev : atBottom))
  }, [])

  useEffect(() => {
    // assumes a chat room is a peerId thus a direct message
    if (roomId === PUBLIC_CHAT_ROOM_ID) {
      setMessages(messageHistory.filter((msg) => !msg.channel || msg.channel === 'public'))
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
    if (isMessageListAtBottom) {
      scrollMessagesToBottom('auto')
    }
  }, [isMessageListAtBottom, messages, scrollMessagesToBottom])

  useEffect(() => {
    setIsMessageListAtBottom(true)
    scrollMessagesToBottom('auto')
  }, [roomId, scrollMessagesToBottom])

  useEffect(() => {
    if (!roomId || roomId === PUBLIC_CHAT_ROOM_ID) {
      return
    }

    try {
      const peer = peerIdFromString(roomId)

      libp2p.dial(peer).catch(() => {})
    } catch {}
  }, [libp2p, roomId])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div className="w-full relative mx-auto gap-6 h-screen min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-6">
      <div className="hidden rounded-sm h-full lg:block">
        <ChatPeerList />
      </div>
      <div
        className={`col-span-1 rounded-sm border border-default-100 lg:col-span-4 flex flex-col min-h-0 h-full overflow-hidden ${
          roomId !== PUBLIC_CHAT_ROOM_ID ? 'bg-default-100/20' : ''
        }`}
      >
        <div
          className={`relative h-12 flex items-center text-sm font-semibold py-2 px-3 border-b border-default-100 text-default-800`}
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
              <Blockies className="rounded mr-2 h-6" scale={10} seed={roomId} size={8} />
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
        <div
          aria-hidden={!showMobilePeerList}
          className={`lg:hidden bg-default-100/50 border backdrop-blur-md border-default-100 absolute left-2 right-2 top-12 z-20 shadow-medium rounded-lg transition-opacity ${
            showMobilePeerList ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
          }`}
        >
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

        <div className={`flex flex-col min-h-0 flex-1 `}>
          <div className="relative flex-1 min-h-0">
            <ScrollShadow
              ref={messageListRef}
              hideScrollBar
              className="h-full"
              offset={24}
              onScroll={handleMessageScroll}
            >
              <ul className="p-3 space-y-1">
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
                      status={message.status}
                    />
                  )
                })}
              </ul>
            </ScrollShadow>
            {!isMessageListAtBottom && (
              <Button
                isIconOnly
                aria-label="Scroll to latest messages"
                className="absolute bottom-4 right-1.5 flex items-center gap-2 rounded-full bg-foreground/30 text-xs font-semibold uppercase tracking-wide text-foreground shadow-lg transition hover:bg-foreground/30"
                size="md"
                onPress={() => scrollMessagesToBottom('smooth')}
              >
                <ChevronDown size={16} />
              </Button>
            )}
          </div>
          <div className="w-full h-fit p-2">
            <div className="flex rounded-xl bg-default-100 p-2 items-end justify-between w-full">
              <Input
                ref={fileRef}
                className="hidden"
                disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                type="file"
                onChange={handleFileInput}
              />
              <Tooltip
                color="default"
                content={roomId === PUBLIC_CHAT_ROOM_ID ? UI_COPY.tooltips.upload : 'Unavailable in DMs'}
                placement="top"
                radius="sm"
              >
                <Button
                  isIconOnly
                  className={`${roomId === PUBLIC_CHAT_ROOM_ID ? '' : 'cursor-not-allowed'} border-1 border-default-100 p-0`}
                  disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                  variant="ghost"
                  onPress={handleFileSend}
                >
                  <Share size={16} />
                </Button>
              </Tooltip>

              <Textarea
                classNames={{ inputWrapper: '!bg-transparent shadow-none' }}
                minRows={1}
                name="message"
                placeholder={composerPlaceholder}
                type="text"
                value={input}
                variant="flat"
                onChange={handleInput}
                onKeyDown={handleKeyDown}
              />
              <div className="flex items-center gap-1">
                {!input && (
                  <>
                    <Tooltip color="secondary" content={UI_COPY.actions.startAiRoom} placement="top" radius="sm">
                      <Button
                        isIconOnly
                        className="border-1 border-default-100"
                        color="secondary"
                        isDisabled={sending}
                        variant="ghost"
                        onPress={handleSendAgentInvite}
                      >
                        <Bot size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip color="primary" content={UI_COPY.actions.goLive} placement="top" radius="sm">
                      <Button
                        isIconOnly
                        className="border-1 border-default-100"
                        color="primary"
                        isDisabled={sending}
                        variant="ghost"
                        onPress={handleSendStreamInvite}
                      >
                        <Cast size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip color="success" content={UI_COPY.actions.startCall} placement="top" radius="sm">
                      <Button
                        isIconOnly
                        className="border-1 border-default-100"
                        color="success"
                        isDisabled={sending}
                        variant="ghost"
                        onPress={handleSendMeetingInvite}
                      >
                        <Video size={16} />
                      </Button>
                    </Tooltip>
                  </>
                )}

                <Tooltip color={input ? 'primary' : 'default'} content={UI_COPY.tooltips.send} placement="top" radius="sm">
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
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
