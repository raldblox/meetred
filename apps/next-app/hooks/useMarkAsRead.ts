import { useEffect } from 'react'

import { useChatContext } from '@/context/chat-ctx'

export function useMarkAsRead(msgId: string, peerId: string, read: boolean, dm: boolean): void {
  const { setMessageHistory, setDirectMessages } = useChatContext()

  useEffect(() => {
    if (read) {
      return
    }

    if (dm) {
      setDirectMessages((prev) => {
        const peerMessages = prev[peerId]

        if (!peerMessages) {
          return prev
        }

        const messageIndex = peerMessages.findIndex((message) => message.msgId === msgId)
        if (messageIndex === -1) {
          return prev
        }

        const message = peerMessages[messageIndex]
        if (message.read) {
          return prev
        }

        const updatedPeerMessages = [...peerMessages]
        updatedPeerMessages[messageIndex] = { ...message, read: true }

        return {
          ...prev,
          [peerId]: updatedPeerMessages,
        }
      })

      return
    }

    setMessageHistory((prev) => {
      const messageIndex = prev.findIndex((message) => message.msgId === msgId)

      if (messageIndex === -1 || prev[messageIndex].read) {
        return prev
      }

      const updatedMessages = [...prev]
      updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], read: true }

      return updatedMessages
    })
  }, [dm, msgId, peerId, read, setDirectMessages, setMessageHistory])
}
