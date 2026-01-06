'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'

import ChatContainer from '@/components/chat/chat-room'
import ConnectionInfoButton from '@/components/chat/connection-info-button'
import ConnectionPanel from '@/components/chat/connection-panel'
import { Navbar } from '@/components/ui/navbar'

export default function Home() {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          animate={{ opacity: 1 }}
          className="relative text-foreground bg-background flex flex-col h-screen overflow-y-scroll md:overflow-y-hidden"
          exit={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          layout="position"
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Navbar />
          <main className="bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">
            <ChatContainer />
          </main>
          <ConnectionPanel isOpen={isConnectionPanelOpen} onClose={() => setIsConnectionPanelOpen(false)} />
          <footer className="w-full border-primary !px-6 py-3 bg-background flex items-center justify-between">
            <div className="text-xs">Metered</div>
            <ConnectionInfoButton onClick={handleOpenConnectionPanel} />
          </footer>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
