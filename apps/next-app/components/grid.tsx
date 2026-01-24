'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'
import { ArrowDownToLine, ArrowUpToLine, HardDrive, MessagesSquare, Radio, Files, Server } from 'lucide-react'
import { Tooltip } from '@heroui/react'

import { Navbar } from './ui/navbar'

import ConnectionInfoButton from '@/components/chat/connection-info-button'
import ConnectionPanel from '@/components/chat/connection-panel'
import { useChatContext } from '@/context/chat-ctx'

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export default function Grid({ main }: { main: React.ReactNode }) {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)
  const { networkTotals } = useChatContext()

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="relative text-foreground bg-background flex flex-col flex-1 h-screen overflow-hidden"
        exit={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        layout="position"
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Navbar />
        <main className="bg-background border-default-100 w-full flex flex-col flex-grow min-h-0">{main}</main>
        <footer className="w-full border-t border-default-100 bg-background px-4 py-2 flex items-center justify-between text-[10px] text-default-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="uppercase tracking-[0.2em] text-[9px] text-default-400">Usage</span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUpToLine className="h-3.5 w-3.5 text-default-400" />
              <span>{formatBytes(networkTotals.sentBytes)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5 text-default-400" />
              <span>{formatBytes(networkTotals.receivedBytes)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-default-400" />
              <span>
                {formatBytes(networkTotals.cachedBytes)} - {networkTotals.cachedFiles} file
                {networkTotals.cachedFiles === 1 ? '' : 's'}
              </span>
            </span>
            <Tooltip
              content={
                <div className="text-xs text-default-700">
                  <div className="flex items-center gap-2">
                    <MessagesSquare className="h-3.5 w-3.5 text-default-500" />
                    <span>
                      DM sent {formatBytes(networkTotals.sentByCategory.dm)} | recv{' '}
                      {formatBytes(networkTotals.receivedByCategory.dm)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5 text-default-500" />
                    <span>
                      Pubsub sent {formatBytes(networkTotals.sentByCategory['pubsub-chat'])} | recv{' '}
                      {formatBytes(networkTotals.receivedByCategory['pubsub-chat'])}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Files className="h-3.5 w-3.5 text-default-500" />
                    <span>
                      Files sent {formatBytes(networkTotals.sentByCategory['file-transfer'])} | recv{' '}
                      {formatBytes(networkTotals.receivedByCategory['file-transfer'])}
                    </span>
                  </div>
                </div>
              }
              placement="top"
              radius="sm"
            >
              <span className="inline-flex items-center gap-1.5 cursor-help">
                <MessagesSquare className="h-3.5 w-3.5 text-default-400" />
                <span>Details</span>
              </span>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-default-400">
              <Server className="h-3 w-3" />
              Network
            </span>
            <ConnectionInfoButton onClick={handleOpenConnectionPanel} />
          </div>
        </footer>
        <ConnectionPanel isOpen={isConnectionPanelOpen} onClose={() => setIsConnectionPanelOpen(false)} />
      </motion.div>
    </AnimatePresence>
  )
}
