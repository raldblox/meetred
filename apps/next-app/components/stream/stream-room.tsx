'use client'

import { useSearchParams } from 'next/navigation'
import { useRef } from 'react'

import { Navbar } from '@/components/ui/navbar'
import { useLibp2pContext } from '@/context/libp2p-ctx'
import { useStreamContext } from '@/context/stream-ctx'

export function StreamRoom({ streamId }: { streamId: string }) {
  const searchParams = useSearchParams()
  const { libp2p } = useLibp2pContext()
  const {} = useStreamContext()
  const localStreamRef = useRef<MediaStream | null>(null)

  return (
    <div className="flex flex-col min-h-screen bg-default-50/40">
      <Navbar />
      <div className="grid lg:grid-cols-3 gap-4 p-4 flex-1 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">{/* <video src={localStreamRef} /> */}</div>
        <div className="flex flex-col min-h-0">{/* <ChatContainer /> */}</div>
      </div>
    </div>
  )
}
