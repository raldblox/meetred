'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { UsersIcon } from '@heroicons/react/24/outline'
import Blockies from 'react-18-blockies'
import { peerIdFromString } from '@libp2p/peer-id'
import { Button, Input, Textarea } from '@heroui/react'
import { GroupIcon, SendIcon, UploadIcon } from 'lucide-react'

import { ChatFile, ChatMessage, useChatContext } from '../context/chat-ctx'

import { ChatPeerList } from './chat-peer-list'
import { Message } from './message'

import { forComponent } from '@/lib/logger'
import { CHAT_FILE_TOPIC, CHAT_TOPIC } from '@/lib/constants'
import { useLibp2pContext } from '@/context/libp2p-ctx'

const log = forComponent('chat')

export const PUBLIC_CHAT_ROOM_ID = ''
const PUBLIC_CHAT_ROOM_NAME = 'Public Chat'

export default function ChatContainer() {
  const { libp2p } = useLibp2pContext()
  const { roomId, setRoomId } = useChatContext()
  const { messageHistory, setMessageHistory, directMessages, setDirectMessages, files, setFiles } = useChatContext()
  const [input, setInput] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [showMobilePeerList, setShowMobilePeerList] = useState(false)

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
    async (readerEvent: ProgressEvent<FileReader>) => {
      const fileBody = readerEvent.target?.result as ArrayBuffer

      const myPeerId = libp2p.peerId.toString()
      const file: ChatFile = {
        id: uuidv4(),
        body: new Uint8Array(fileBody),
        sender: myPeerId,
      }

      setFiles(files.set(file.id, file))

      log(
        `peers in gossip for topic ${CHAT_FILE_TOPIC}:`,
        libp2p.services.pubsub.getSubscribers(CHAT_FILE_TOPIC).toString(),
      )

      const res = await libp2p.services.pubsub.publish(CHAT_FILE_TOPIC, new TextEncoder().encode(file.id))

      log(
        'sent file to: ',
        res.recipients.map((peerId) => peerId.toString()),
      )

      const msg: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: newChatFileMessage(file.id, file.body),
        fileObjectUrl: window.URL.createObjectURL(new Blob([file.body as any])),
        peerId: myPeerId,
        read: true,
        receivedAt: Date.now(),
      }

      setMessageHistory([...messageHistory, msg])
    },
    [messageHistory, libp2p, setMessageHistory, files, setFiles],
  )

  const newChatFileMessage = (id: string, body: Uint8Array) => {
    return `File: ${id} (${body.length} bytes)`
  }

  const handleKeyUp = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') {
        return
      }
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        sendPublicMessage()
      } else {
        sendDirectMessage()
      }
    },
    [sendPublicMessage, sendDirectMessage, roomId],
  )

  const handleSend = useCallback(
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
      if (roomId === PUBLIC_CHAT_ROOM_ID) {
        sendPublicMessage()
      } else {
        sendDirectMessage()
      }
    },
    [sendPublicMessage, sendDirectMessage, roomId],
  )

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value)
    },
    [setInput],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const reader = new FileReader()

        reader.readAsArrayBuffer(e.target.files[0])
        reader.onload = (readerEvent) => {
          sendFile(readerEvent)
        }
      }
    },
    [sendFile],
  )

  const handleFileSend = useCallback(
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
      fileRef?.current?.click()
    },
    [fileRef],
  )

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

  return (
    <div className="w-full relative border-x border-default-100 mx-auto container h-full min-h-0 grid grid-cols-1 lg:grid-cols-6">
      <div className="hidden h-full lg:block border-r border-default-100">
        <ChatPeerList />
      </div>
      <div className="col-span-1 lg:col-span-5 flex flex-col min-h-0 h-full overflow-hidden">
        <div className="relative h-10 flex items-center text-sm font-semibold py-2 px-3 border-b border-default-100 text-default-800">
          {roomId === PUBLIC_CHAT_ROOM_ID && (
            <>
              <span className="block ml-2 font-bold">{PUBLIC_CHAT_ROOM_NAME}</span>
              <button
                aria-label="Toggle peer list"
                className="ml-auto lg:hidden flex items-center text-default-500 hover:text-default-700"
                onClick={toggleMobilePeerList}
              >
                <UsersIcon className="h-4 w-4" />
                <span className="ml-1 text-sm">Peers</span>
              </button>
            </>
          )}
          {roomId !== PUBLIC_CHAT_ROOM_ID && (
            <>
              <Blockies className="rounded mr-2 h-8" scale={3} seed={roomId} size={12} />
              <span className="text-default-500 flex">{roomId.toString().slice(-7)}</span>
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
                  className="text-default-500 flex items-center"
                  size="sm"
                  variant="flat"
                  onPress={handleBackToPublic}
                >
                  <ChevronLeftIcon className="w-6 h-6 text-default-500" />
                  <span className="hidden sm:inline">Back to Public Chat</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
            </>
          )}
        </div>
        {showMobilePeerList && (
          <div className="lg:hidden border-b border-default-100">
            <div className="flex items-center justify-between p-2 bg-default-50">
              <h2 className="text-lg text-default-600">Peers</h2>
              <Button
                aria-label="Close peer list"
                className="text-default-500 hover:text-default-700"
                onPress={() => {
                  toggleMobilePeerList
                }}
              >
                <GroupIcon size={16} />
              </Button>
            </div>
            <ChatPeerList hideHeader={true} />
          </div>
        )}

        <div className="flex flex-col min-h-0 flex-1">
          <ul className="p-3 space-y-2 overflow-y-auto flex-1 min-h-0">
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
          <div className="flex p-2 py-3 gap-2 items-start justify-between w-full border-t border-default-100">
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
              onPress={() => {
                handleFileSend
              }}
            >
              <UploadIcon size={16} />
            </Button>

            <Textarea
              minRows={3}
              name="message"
              placeholder="Message"
              type="text"
              value={input}
              variant="flat"
              onChange={handleInput}
              onKeyUp={handleKeyUp}
            />
            <Button
              isIconOnly
              className="border-1 border-default-100"
              type="submit"
              variant="bordered"
              onPress={() => {
                handleSend
              }}
            >
              <SendIcon size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
