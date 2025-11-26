'use client'

import { useState } from 'react'

import ChatContainer from '@/components/chat'
import ConnectionInfoButton from '@/components/connection-info-button'
import ConnectionPanel from '@/components/connection-panel'
import { Navbar } from '@/components/navbar'

export default function Home() {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }

  return (
    <>
      <div className="relative flex flex-col h-screen">
        <Navbar />
        <main className="mx-auto border-y border-default-100 w-full flex flex-col flex-grow min-h-0">
          <ChatContainer />
        </main>
        <ConnectionPanel isOpen={isConnectionPanelOpen} onClose={() => setIsConnectionPanelOpen(false)} />
        <footer className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between py-3">
          <div>Metered</div>
          <ConnectionInfoButton onClick={handleOpenConnectionPanel} />
        </footer>
      </div>
    </>
  )
}
