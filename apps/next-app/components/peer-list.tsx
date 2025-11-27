import type { PeerId, Connection } from '@libp2p/interface'

import { XCircleIcon } from 'lucide-react'
import { Button, Chip } from '@heroui/react'
import { useCallback } from 'react'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { BOOTSTRAP_PEER_IDS } from '@/lib/constants'

interface PeerListProps {
  connections: Connection[]
}

export default function PeerList({ connections }: PeerListProps) {
  return (
    <ul className="divide-y divide-default-100 space-y-2">
      {connections.map((connection) => {
        if (BOOTSTRAP_PEER_IDS.includes(connection.remotePeer.toString())) {
          return null
        }

        return <Peer key={connection.id} connection={connection} />
      })}
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
    <li key={connection.id} className="flex bg-default-100 px-3 rounded-xl items-center justify-between gap-x-6 py-2">
      <div className="flex min-w-0 gap-x-4 flex-grow">
        <div className="min-w-0 flex-auto">
          <div className="flex flex-wrap items-center gap-2">
            {/* <div className="h-1.5 w-1.5 rounded-full bg-success" /> */}
            <span className="text-sm font-semibold leading-6 text-default-900 break-all">
              {connection.remotePeer.toString()}
            </span>
            {connection.remoteAddr.protoNames().includes('webrtc') ? (
              <Chip className="min-w-fit" color="primary" size="sm" variant="flat">
                P2P Browser
              </Chip>
            ) : null}
          </div>
          <div className="text-xs leading-5 text-default-500 break-words">
            <span className="break-all">{ipAddr}</span>
            <span className="break-all">{connection.remoteAddr.protoNames().join(', ')}</span>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 ml-2">
        <Button
          isIconOnly
          color="danger"
          title="Disconnect peer"
          variant="flat"
          onPress={() => handleDisconnectPeer(connection.remotePeer)}
        >
          <XCircleIcon className="w-5 h-5" />
          <span className="sr-only">Disconnect</span>
        </Button>
      </div>
    </li>
  )
}
