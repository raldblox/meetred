'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { Input } from '@heroui/react'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { Navbar } from '@/components/ui/navbar'

export default function StreamLobby() {
  const { libp2p } = useLibp2pContext()
  const router = useRouter()
  const [joinId, setJoinId] = useState('')

  const handleStartStream = () => {
    if (libp2p?.peerId) {
      router.push(`/stream/${libp2p.peerId.toString()}`)
    }
  }

  const handleJoinStream = (e: React.FormEvent) => {
    e.preventDefault()
    if (joinId.trim()) {
      router.push(`/stream/${joinId.trim()}`)
    }
  }

  if (!libp2p) {
    return (
      <div className="flex flex-col min-h-screen bg-default-50/40">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-default-500">Initializing P2P Network...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-default-50/40">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">P2P Streaming</h1>
          <p className="text-default-500">Host a stream or join one directly via PeerID.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl justify-center items-start">
          {/* Host Section */}
          <div className="flex-1 w-full p-6 rounded-2xl border border-default-200 bg-white/50 shadow-sm flex flex-col gap-4 items-center">
            <div className="p-3 rounded-full bg-primary-100 text-primary-600">
              <svg
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M23 7l-7 5 7 5V7z" />
                <rect height="14" rx="2" ry="2" width="15" x="1" y="5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Start a Stream</h2>
            <p className="text-sm text-default-500 text-center">
              You will be the host. Share your Stream ID (Peer ID) with others so they can watch.
            </p>
            <Button className="w-full" color="primary" onPress={handleStartStream}>
              Start Streaming
            </Button>
          </div>

          {/* Join Section */}
          <div className="flex-1 w-full p-6 rounded-2xl border border-default-200 bg-white/50 shadow-sm flex flex-col gap-4 items-center">
            <div className="p-3 rounded-full bg-secondary-100 text-secondary-600">
              <svg
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Join a Stream</h2>
            <p className="text-sm text-default-500 text-center">
              Enter the Stream ID provided by the host to join their broadcast.
            </p>
            <form className="w-full flex gap-2" onSubmit={handleJoinStream}>
              <Input
                className="flex-1"
                placeholder="Enter Stream ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
              <Button type="submit" variant="flat">
                Join
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
