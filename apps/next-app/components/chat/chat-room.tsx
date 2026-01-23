'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import Blockies from 'react-18-blockies'
import { peerIdFromString } from '@libp2p/peer-id'
import { Button, Input, Spinner, Textarea, Tooltip, ScrollShadow } from '@heroui/react'
import { ChevronLeftIcon, UsersIcon, Video, X, ChevronDown, Bot, Paperclip, Radio, SendHorizontal } from 'lucide-react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

import { ChatFile, ChatMessage, useChatContext } from '../../context/chat-ctx'

import { ChatPeerList } from './chat-peer-list'
import { Message } from './message'

import { forComponent } from '@/lib/logger'
import { CHAT_FILE_TOPIC, CHAT_TOPIC } from '@/config/constants'
import { UI_COPY } from '@/config/copy'
import { wrapMeetredMessage } from '@/lib/envelope'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { publishAnalyticsEvent } from '@/lib/analytics'

const log = forComponent('chat')

export const PUBLIC_CHAT_ROOM_ID = ''

export const getIsMobile = () => (typeof window !== 'undefined' ? window.innerWidth < 640 : false)

export default function ChatContainer() {
  const { libp2p, refreshPeerDiscovery } = useLibp2pContext()
  const { roomId, setRoomId, recordNetworkUsage } = useChatContext()
  const { messageHistory, setMessageHistory, directMessages, setDirectMessages, files, setFiles } = useChatContext()
  const [input, setInput] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [showMobilePeerList, setShowMobilePeerList] = useState(false)
  const [isMessageListAtBottom, setIsMessageListAtBottom] = useState(true)
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile())
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const composerPlaceholder = UI_COPY.composer.placeholder
  const chatShellRef = useRef<HTMLDivElement | null>(null)
  const messagePanelRef = useRef<HTMLDivElement | null>(null)
  const peerListRef = useRef<HTMLDivElement | null>(null)
  const mobilePeerListRef = useRef<HTMLDivElement | null>(null)

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
        const envelope = wrapMeetredMessage(trimmedMessage)
        const encoded = new TextEncoder().encode(envelope)
        recordNetworkUsage('sent', 'pubsub-chat', encoded.length)
        const res = await libp2p.services.pubsub.publish(CHAT_TOPIC, encoded)

        log(
          'sent message to: ',
          res.recipients.map((peerId) => peerId.toString()),
        )

        setMessageHistory((prev) =>
          prev.map((message) => (message.msgId === pendingMessage.msgId ? { ...message, status: 'sent' } : message)),
        )
        await publishAnalyticsEvent(libp2p, {
          event: 'chat_message_sent',
          peerId: myPeerId,
          roomType: 'public',
          roomId: 'public',
          channel: 'public',
        })
      } catch (error) {
        log.error('failed to send public message %o', error)
        setMessageHistory((prev) =>
          prev.map((message) => (message.msgId === pendingMessage.msgId ? { ...message, status: 'failed' } : message)),
        )
        throw error
      }
    },
    [libp2p, recordNetworkUsage, setMessageHistory],
  )

  const ensurePeerConnected = useCallback(
    async (peerId: string) => {
      try {
        const peer = peerIdFromString(peerId)
        if (libp2p.getConnections(peer)?.length > 0) {
          return true
        }

        await refreshPeerDiscovery()

        try {
          await libp2p.dial(peer)
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 300))
          await libp2p.dial(peer)
        }

        return (libp2p.getConnections(peer) ?? []).length > 0
      } catch {
        return false
      }
    },
    [libp2p, refreshPeerDiscovery],
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
        channel: 'dm',
      }

      setDirectMessages((prev) => {
        const existing = prev[targetRoomId] ?? []

        return {
          ...prev,
          [targetRoomId]: [...existing, pendingMessage],
        }
      })

      try {
        await ensurePeerConnected(targetRoomId)
        const outgoingBytes = new TextEncoder().encode(trimmedMessage).length
        if (outgoingBytes > 0) {
          recordNetworkUsage('sent', 'dm', outgoingBytes)
        }
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
        await publishAnalyticsEvent(libp2p, {
          event: 'chat_message_sent',
          peerId: myPeerId,
          roomType: 'dm',
          roomId: targetRoomId,
          channel: 'dm',
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
    [ensurePeerConnected, libp2p, recordNetworkUsage, roomId, setDirectMessages],
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
      const encoded = new TextEncoder().encode(payload)
      recordNetworkUsage('sent', 'pubsub-file-meta', encoded.length)
      const res = await libp2p.services.pubsub.publish(CHAT_FILE_TOPIC, encoded)

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
      await publishAnalyticsEvent(libp2p, {
        event: 'invite_sent',
        peerId: hostPeerId,
        roomType: 'call',
        roomId: hostPeerId,
        channel: roomId === PUBLIC_CHAT_ROOM_ID ? 'public' : 'dm',
      })
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
      await publishAnalyticsEvent(libp2p, {
        event: 'invite_sent',
        peerId: hostPeerId,
        roomType: 'stream',
        roomId: hostPeerId,
        channel: roomId === PUBLIC_CHAT_ROOM_ID ? 'public' : 'dm',
      })
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
      await publishAnalyticsEvent(libp2p, {
        event: 'invite_sent',
        peerId: hostPeerId,
        roomType: 'ai',
        roomId: hostPeerId,
        channel: roomId === PUBLIC_CHAT_ROOM_ID ? 'public' : 'dm',
      })
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

  // Mark messages as read when viewing a room (helps keep unread badge accurate after backfill)
  useEffect(() => {
    if (!roomId || roomId === PUBLIC_CHAT_ROOM_ID) {
      return
    }

    const existing = directMessages[roomId]

    if (!existing || existing.length === 0) {
      return
    }

    const hasUnread = existing.some((m) => !m.read)

    if (!hasUnread) {
      return
    }

    setDirectMessages((prev) => {
      const current = prev[roomId] ?? []

      return {
        ...prev,
        [roomId]: current.map((m) => (m.read ? m : { ...m, read: true })),
      }
    })
  }, [directMessages, roomId, setDirectMessages])

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

  useEffect(() => {
    const updateIsMobile = () => setIsMobile(getIsMobile())

    updateIsMobile()
    window.addEventListener('resize', updateIsMobile)

    return () => window.removeEventListener('resize', updateIsMobile)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (roomId === PUBLIC_CHAT_ROOM_ID) return
      if (!chatShellRef.current) return

      const target = event.target as Node | null
      const path = (event as any).composedPath?.() ?? []
      const messagePanel = messagePanelRef.current
      const peerList = peerListRef.current
      const mobilePeerList = mobilePeerListRef.current

      if (messagePanel && (path.includes(messagePanel) || messagePanel.contains(target as Node))) {
        return
      }
      if (peerList && (path.includes(peerList) || peerList.contains(target as Node))) {
        return
      }
      if (mobilePeerList && (path.includes(mobilePeerList) || mobilePeerList.contains(target as Node))) {
        return
      }

      setRoomId(PUBLIC_CHAT_ROOM_ID)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [roomId, setRoomId])

  return (
    <div
      ref={chatShellRef}
      className={`w-full px-6 relative transition-all mx-auto gap-6 h-screen min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-6 ${
        roomId === PUBLIC_CHAT_ROOM_ID ? '' : ''
      }`}
    >
      <div ref={peerListRef} className="hidden rounded-sm h-full lg:block">
        <ChatPeerList />
      </div>
      <div
        ref={messagePanelRef}
        className={`col-span-1 lg:col-span-4 flex flex-col min-h-0 h-full overflow-hidden ${
          roomId !== PUBLIC_CHAT_ROOM_ID ? 'bg-zinc-900 rounded-2xl' : 'flex'
        }`}
      >
        <div
          className={`relative h-12 flex items-center text-sm font-semibold text-default-800 ${
            roomId !== PUBLIC_CHAT_ROOM_ID ? 'border-b  px-3 border-default-100' : ''
          }`}
        >
          {roomId === PUBLIC_CHAT_ROOM_ID && (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-default-700">Public room</p>
                <p className="text-[11px] uppercasee text-default-400">Visible to everyone</p>
              </div>

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
                  className="h-7 flex items-center"
                  color="default"
                  size="sm"
                  variant="solid"
                  onPress={handleBackToPublic}
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  <span className="hidden text-sm sm:inline">Public Chat</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
            </>
          )}
        </div>
        <div
          ref={mobilePeerListRef}
          aria-hidden={!showMobilePeerList}
          className={`lg:hidden transition-all bg-default-100/50 border backdrop-blur-md border-default-100 absolute left-6 right-4 top-12 z-20 shadow-medium rounded-lg ${
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
              color="default"
              size="sm"
              variant="light"
              onPress={toggleMobilePeerList}
            >
              <X size={16} />
            </Button>
          </div>
          <div className="px-3 pb-3">
            <ChatPeerList hideHeader={true} />
          </div>
        </div>

        <div
          className={`flex flex-col transition-all min-h-0 flex-1 py-3 ${roomId !== PUBLIC_CHAT_ROOM_ID ? 'px-3' : 'md:pb-6'}`}
        >
          <div className="relative flex-1 min-h-0">
            <ScrollShadow
              ref={messageListRef}
              hideScrollBar
              className="h-full scroll-smooth pb-12"
              offset={24}
              onScroll={handleMessageScroll}
            >
              <ul className="space-y-1">
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
            <Button
              isIconOnly
              aria-label="Scroll to latest messages"
              className={`${isMessageListAtBottom ? 'opacity-0' : 'opacity-100'} transition-all absolute bottom-4 right-0 flex items-center gap-2 rounded-full bg-foreground/30 text-xs font-semibold uppercase tracking-wide text-foreground shadow-lg hover:bg-foreground/30`}
              size="sm"
              onPress={() => scrollMessagesToBottom('smooth')}
            >
              <ChevronDown size={16} />
            </Button>
          </div>
          <div className="w-full h-fit">
            {roomId !== PUBLIC_CHAT_ROOM_ID && roomId && (
              <span className="text-tiny text-default-500">Direct message · ${roomId.toString().slice(-7)}</span>
            )}

            <div className="rounded-medium pt-1 bg-default-100 hover:bg-default-200/70 flex w-full flex-col items-start transition-colors">
              <Textarea
                classNames={{
                  inputWrapper: 'bg-transparent! shadow-none',
                  innerWrapper: 'relative',
                  input: 'pt-1 pl-2 pb-6 pr-10! text-medium',
                }}
                endContent={
                  <div className="flex items-center gap-1">
                    <Tooltip
                      color={input ? 'primary' : 'default'}
                      content={UI_COPY.tooltips.composer.send}
                      placement="top"
                      radius="sm"
                    >
                      <Button
                        isIconOnly
                        className="border-1 border-default-100"
                        color={input ? 'primary' : 'default'}
                        isDisabled={sending}
                        type="submit"
                        variant="solid"
                        onPress={handleSend}
                      >
                        {sending ? <Spinner size="sm" /> : <SendHorizontal size={16} />}
                      </Button>
                    </Tooltip>
                  </div>
                }
                minRows={1}
                name="message"
                placeholder={composerPlaceholder}
                type="text"
                value={input}
                variant="flat"
                onChange={handleInput}
                onKeyDown={handleKeyDown}
              />
              <div className="flex w-full items-end justify-between gap-2 overflow-auto px-4 pb-4">
                <div className="flex w-full gap-1 md:gap-1.5">
                  <>
                    <Input
                      ref={fileRef}
                      className="hidden"
                      disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                      type="file"
                      onChange={handleFileInput}
                    />
                    <Tooltip
                      color="default"
                      content={roomId === PUBLIC_CHAT_ROOM_ID ? UI_COPY.tooltips.composer.attach : 'Unavailable in DMs'}
                      placement="top"
                      radius="sm"
                    >
                      <Button
                        className={`${roomId === PUBLIC_CHAT_ROOM_ID ? '' : 'cursor-not-allowed'} gap-1`}
                        disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                        isIconOnly={isMobile}
                        size="sm"
                        startContent={<Paperclip size={16} />}
                        variant="flat"
                        onPress={handleFileSend}
                      >
                        <span className="hidden sm:inline">{UI_COPY.actions.attach}</span>
                      </Button>
                    </Tooltip>
                    <Tooltip color="secondary" content={UI_COPY.tooltips.composer.aiRoom} placement="top" radius="sm">
                      <Button
                        className="border-1 border-default-100 gap-1"
                        color="secondary"
                        isDisabled={sending}
                        isIconOnly={isMobile}
                        size="sm"
                        startContent={<Bot size={16} />}
                        variant="flat"
                        onPress={handleSendAgentInvite}
                      >
                        <span className="hidden sm:inline">{UI_COPY.actions.aiRoom}</span>
                      </Button>
                    </Tooltip>
                    <Tooltip color="primary" content={UI_COPY.tooltips.composer.stream} placement="top" radius="sm">
                      <Button
                        className="border-1 border-default-100 gap-1"
                        color="danger"
                        isDisabled={sending}
                        isIconOnly={isMobile}
                        size="sm"
                        startContent={<Radio size={16} />}
                        variant="flat"
                        onPress={handleSendStreamInvite}
                      >
                        <span className="hidden sm:inline">{UI_COPY.actions.stream}</span>
                      </Button>
                    </Tooltip>
                    <Tooltip color="success" content={UI_COPY.tooltips.composer.call} placement="top" radius="sm">
                      <Button
                        className="border-1 border-default-100 gap-1"
                        color="success"
                        isDisabled={sending}
                        isIconOnly={isMobile}
                        size="sm"
                        startContent={<Video size={16} />}
                        variant="flat"
                        onPress={handleSendMeetingInvite}
                      >
                        <span className="hidden sm:inline">{UI_COPY.actions.call}</span>
                      </Button>
                    </Tooltip>
                  </>
                </div>
                <p className="text-tiny leading-0 text-default-400 py-1">{input.length}/2000</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
