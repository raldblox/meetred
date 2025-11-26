'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { UsersIcon } from '@heroicons/react/24/outline'
import Blockies from 'react-18-blockies'
import { peerIdFromString } from '@libp2p/peer-id'

import { ChatFile, ChatMessage, useChatContext } from '../context/chat-ctx'

import { ChatPeerList } from './chat-peer-list'
import { Message } from './message'

import { forComponent } from '@/lib/logger'
import { CHAT_FILE_TOPIC, CHAT_TOPIC } from '@/lib/constants'
import { useLibp2pContext } from '@/context/ctx'
import { Input } from '@heroui/react'

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
    if (input === '') return

    log(`peers in gossip for topic ${CHAT_TOPIC}:`, libp2p.services.pubsub.getSubscribers(CHAT_TOPIC).toString())

    const res = await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(input))

    log(
      'sent message to: ',
      res.recipients.map((peerId) => peerId.toString()),
    )

    const myPeerId = libp2p.peerId.toString()

    setMessageHistory([
      ...messageHistory,
      {
        msgId: crypto.randomUUID(),
        msg: input,
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
    try {
      const res = await libp2p.services.directMessage.send(peerIdFromString(roomId), input)

      if (!res) {
        log('Failed to send message')

        return
      }

      const myPeerId = libp2p.peerId.toString()

      const newMessage: ChatMessage = {
        msgId: crypto.randomUUID(),
        msg: input,
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
    async (e: React.MouseEvent<HTMLButtonElement>) => {
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
    <div className="w-full relative 2xl:border-x border-default-200 mx-auto container h-full min-h-0 grid grid-cols-1 lg:grid-cols-6">
      <div className="hidden h-full lg:block">
        <ChatPeerList />
      </div>
      <div className="col-span-1 lg:col-span-5 flex flex-col min-h-0 h-full overflow-hidden">
        <div className="relative bg-default-100 flex items-center text-sm font-semibold py-2 px-3 border-b border-default-300 text-default-800">
          {roomId === PUBLIC_CHAT_ROOM_ID && (
            <>
              <span className="block ml-2 font-bold">{PUBLIC_CHAT_ROOM_NAME}</span>
              <button
                aria-label="Toggle peer list"
                className="ml-auto lg:hidden flex items-center text-gray-500 hover:text-gray-700"
                onClick={toggleMobilePeerList}
              >
                <UsersIcon className="h-5 w-5" />
                <span className="ml-1 text-sm">Peers</span>
              </button>
            </>
          )}
          {roomId !== PUBLIC_CHAT_ROOM_ID && (
            <>
              <Blockies className="rounded mr-2 max-h-10 max-w-10" scale={3} seed={roomId} size={8} />
              <span className={`text-gray-500 flex`}>{roomId.toString().slice(-7)}</span>
              <div className="flex items-center ml-auto">
                <button
                  aria-label="Toggle peer list"
                  className="lg:hidden flex items-center text-gray-500 hover:text-gray-700 mr-4"
                  onClick={toggleMobilePeerList}
                >
                  <UsersIcon className="h-5 w-5" />
                  <span className="ml-1 text-sm">Peers</span>
                </button>
                <button className="text-gray-500 flex" onClick={handleBackToPublic}>
                  <ChevronLeftIcon className="w-6 h-6 text-gray-500" />
                  <span className="hidden sm:inline">Back to Public Chat</span>
                  <span className="sm:hidden">Back</span>
                </button>
              </div>
            </>
          )}
        </div>
        {showMobilePeerList && (
          <div className="lg:hidden border-b border-gray-300">
            <div className="flex items-center justify-between p-2 bg-gray-50">
              <h2 className="text-lg text-gray-600">Peers</h2>
              <button
                aria-label="Close peer list"
                className="text-gray-500 hover:text-gray-700"
                onClick={toggleMobilePeerList}
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path
                    clipRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    fillRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <ChatPeerList hideHeader={true} />
          </div>
        )}

        <div className="flex flex-col min-h-0 flex-1">
          <ul className="space-y-2 p-3 overflow-y-auto flex-1 min-h-0">
            {messages.map(({ msgId, msg, fileObjectUrl, peerId, read, receivedAt }: ChatMessage) => (
              <Message
                key={msgId}
                dm={roomId !== ''}
                fileObjectUrl={fileObjectUrl}
                msg={msg}
                msgId={msgId}
                peerId={peerId}
                read={read}
                receivedAt={receivedAt}
              />
            ))}
          </ul>
          <div className="flex p-2 bg-default-100 py-3 gap-2 items-center justify-between w-full border-t border-gray-300">
            <Input
              ref={fileRef}
              className="hidden"
              disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
              type="file"
              onChange={handleFileInput}
            />
            <button
              className={`${roomId === PUBLIC_CHAT_ROOM_ID ? '' : 'cursor-not-allowed'} p-1`}
              disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
              title={roomId === PUBLIC_CHAT_ROOM_ID ? 'Upload file' : "Unsupported in DM's"}
              onClick={handleFileSend}
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <Input
              required
              name="message"
              placeholder="Message"
              type="text"
              value={input}
              onChange={handleInput}
              onKeyUp={handleKeyUp}
            />
            <button type="submit" onClick={handleSend}>
              <svg
                className="w-5 h-5 text-gray-500 origin-center transform rotate-90"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {/* <div className="col-span-1 lg:col-span-5 h-full">
        <div className="w-full h-full">
          <div className="relative flex items-center text-sm font-semibold py-2 px-3 border-b border-default-300 text-default-800">
            {roomId === PUBLIC_CHAT_ROOM_ID && (
              <>
                <span className="block ml-2 font-bold text-blue-600">{PUBLIC_CHAT_ROOM_NAME}</span>
                <button
                  aria-label="Toggle peer list"
                  className="ml-auto lg:hidden flex items-center text-gray-500 hover:text-gray-700"
                  onClick={toggleMobilePeerList}
                >
                  <UsersIcon className="h-5 w-5" />
                  <span className="ml-1 text-sm">Peers</span>
                </button>
              </>
            )}
            {roomId !== PUBLIC_CHAT_ROOM_ID && (
              <>
                <Blockies className="rounded mr-2 max-h-10 max-w-10" scale={3} seed={roomId} size={8} />
                <span className={`text-gray-500 flex`}>{roomId.toString().slice(-7)}</span>
                <div className="flex items-center ml-auto">
                  <button
                    aria-label="Toggle peer list"
                    className="lg:hidden flex items-center text-gray-500 hover:text-gray-700 mr-4"
                    onClick={toggleMobilePeerList}
                  >
                    <UsersIcon className="h-5 w-5" />
                    <span className="ml-1 text-sm">Peers</span>
                  </button>
                  <button className="text-gray-500 flex" onClick={handleBackToPublic}>
                    <ChevronLeftIcon className="w-6 h-6 text-gray-500" />
                    <span className="hidden sm:inline">Back to Public Chat</span>
                    <span className="sm:hidden">Back</span>
                  </button>
                </div>
              </>
            )}
          </div>
          {showMobilePeerList && (
            <div className="lg:hidden border-b border-gray-300">
              <div className="flex items-center justify-between p-2 bg-gray-50">
                <h2 className="text-lg text-gray-600">Peers</h2>
                <button
                  aria-label="Close peer list"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={toggleMobilePeerList}
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path
                      clipRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      fillRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <ChatPeerList hideHeader={true} />
            </div>
          )}

          <div className=" bg-amber-300 w-full flex flex-col-reverse p-3">
            <ul className="space-y-2 h-full">
              {messages.map(({ msgId, msg, fileObjectUrl, peerId, read, receivedAt }: ChatMessage) => (
                <Message
                  key={msgId}
                  dm={roomId !== ''}
                  fileObjectUrl={fileObjectUrl}
                  msg={msg}
                  msgId={msgId}
                  peerId={peerId}
                  read={read}
                  receivedAt={receivedAt}
                />
              ))}
            </ul>
            <div className="flex gap-2 items-center h-full justify-between w-full p-2 sm:p-3 border-t border-gray-300">
              <Input
                ref={fileRef}
                className="hidden"
                disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                type="file"
                onChange={handleFileInput}
              />
              <button
                className={`${roomId === PUBLIC_CHAT_ROOM_ID ? '' : 'cursor-not-allowed'} p-1`}
                disabled={roomId !== PUBLIC_CHAT_ROOM_ID}
                title={roomId === PUBLIC_CHAT_ROOM_ID ? 'Upload file' : "Unsupported in DM's"}
                onClick={handleFileSend}
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>

              <Input
                required
                name="message"
                placeholder="Message"
                type="text"
                value={input}
                onChange={handleInput}
                onKeyUp={handleKeyUp}
              />
              <button type="submit" onClick={handleSend}>
                <svg
                  className="w-5 h-5 text-gray-500 origin-center transform rotate-90"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  )
}
