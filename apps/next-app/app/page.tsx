'use client'

import { useState } from 'react'

import ChatContainer from '@/components/chat/chat-room'
import ConnectionInfoButton from '@/components/chat/connection-info-button'
import ConnectionPanel from '@/components/chat/connection-panel'
import Grid from '@/components/grid'

export default function Home() {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }

  return (
    <Grid
      footer={
        <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between">
          <div className="text-xs">Meetred</div>
          <ConnectionInfoButton onClick={handleOpenConnectionPanel} />
        </footer>
      }
      main={<ChatContainer />}
      panel={<ConnectionPanel isOpen={isConnectionPanelOpen} onClose={() => setIsConnectionPanelOpen(false)} />}
    />
  )
}
