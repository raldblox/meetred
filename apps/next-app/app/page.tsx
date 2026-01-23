'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, HardDrive, MessagesSquare, Radio, Files } from 'lucide-react'
import { Tooltip } from '@heroui/react'

import ChatContainer from '@/components/chat/chat-room'
import ConnectionInfoButton from '@/components/chat/connection-info-button'
import ConnectionPanel from '@/components/chat/connection-panel'
import Grid from '@/components/grid'
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

export default function Home() {
  const [isConnectionPanelOpen, setIsConnectionPanelOpen] = useState(false)
  const { networkTotals } = useChatContext()

  const handleOpenConnectionPanel = () => {
    setIsConnectionPanelOpen(true)
  }

  return (
    <Grid
      footer={
        <footer className="w-full border-t border-default-100 !px-6 py-3 bg-background flex items-center justify-between">
          <div className="text-[10px] text-default-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="uppercase text-[10px] tracking-wide text-default-400">Usage</span>
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
          </div>
          <ConnectionInfoButton onClick={handleOpenConnectionPanel} />
        </footer>
      }
      main={<ChatContainer />}
      panel={<ConnectionPanel isOpen={isConnectionPanelOpen} onClose={() => setIsConnectionPanelOpen(false)} />}
    />
  )
}
