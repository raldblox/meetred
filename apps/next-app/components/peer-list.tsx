import type { PeerId, Connection } from '@libp2p/interface'

import { XCircleIcon } from '@heroicons/react/24/solid'
import { Chip } from '@heroui/react'
import { useCallback } from 'react'

import { useLibp2pContext } from '@/context/ctx'

interface PeerListProps {
  connections: Connection[]
}

export default function PeerList({ connections }: PeerListProps) {
  return (
    <ul className="divide-y divide-default-100">
      {connections.map((connection) => (
        <Peer key={connection.id} connection={connection} />
      ))}
    </ul>
  )
}

interface PeerProps {
  connection: Connection
}
function Peer({ connection }: PeerProps) {
  const { libp2p } = useLibp2pContext()

  const handleDisconnectPeer = useCallback(
    (peerId: PeerId) => {
      libp2p.hangUp(peerId)
    },
    [libp2p],
  )

  let ipAddr

  try {
    const nodeAddr = connection.remoteAddr?.nodeAddress()

    ipAddr = `${nodeAddr.address}:${nodeAddr.port} |`
  } catch {
    ipAddr = null
  }

  return (
    <li key={connection.id} className="flex justify-between gap-x-6 py-3">
      <div className="flex min-w-0 gap-x-4 flex-grow">
        <div className="mt-1 flex items-center gap-x-1.5">
          <div className="flex-none rounded-full bg-success/20 p-1">
            <div className="h-1.5 w-1.5 rounded-full bg-success" />
          </div>
        </div>
        {/* <img className="h-12 w-12 flex-none rounded-full bg-default-50" src={person.imageUrl} alt="" /> */}
        <div className="min-w-0 flex-auto">
          <p className="text-sm font-semibold leading-6 text-default-900">
            {connection.remotePeer.toString()}{' '}
            {connection.remoteAddr.protoNames().includes('webrtc') ? (
              <Chip className="ml-2" size="sm" variant="flat">
                P2P Browser
              </Chip>
            ) : null}
          </p>
          <p className="mt-1 truncate text-xs leading-5 text-default-500">
            {ipAddr} {connection.remoteAddr.protoNames().join(', ')}
          </p>
        </div>
      </div>

      <div className="flex-shrink-0 ml-2">
        <button
          className="bg-danger hover:bg-danger/90 text-white rounded-full p-2 flex items-center justify-center"
          title="Disconnect peer"
          onClick={() => handleDisconnectPeer(connection.remotePeer)}
        >
          <XCircleIcon className="w-5 h-5" />
          <span className="sr-only">Disconnect</span>
        </button>
      </div>
    </li>
  )
}
