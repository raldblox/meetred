'use client'

import { useState } from 'react'

import ChatContainer from '@/components/chat/chat-room'
import { ChatPeerList } from '@/components/chat/chat-peer-list'

export default function Home() {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }

  return (
    <>
      <div className="h-screen grid-cols-5">
        <div className="grid-cols-4">
          <ChatContainer />
        </div>
        <div className="grid-cols-1">
          <ChatPeerList />
        </div>
      </div>
    </>
  )
}
