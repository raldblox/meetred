'use client'

import ChatContainer from '@/components/chat'
import ConnectionInfoButton from '@/components/connection-info-button'
import ConnectionPanel from '@/components/connection-panel'
import Navigation from '@/components/nav'
import { useState } from 'react'

export default function Home() {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }
  return (
    <section className="flex flex-col">
      <Navigation connectionInfoButton={<ConnectionInfoButton onClick={handleOpenConnectionPanel} />} />
      <ChatContainer />
      <ConnectionPanel isOpen={isConnectionPanelOpen} onClose={() => setIsConnectionPanelOpen(false)} />
    </section>
  )
}
