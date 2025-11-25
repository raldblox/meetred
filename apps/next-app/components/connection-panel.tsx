'use client'

import type { PeerUpdate, Connection } from '@libp2p/interface'

import { useCallback, useEffect, useState } from 'react'
import { Multiaddr, multiaddr } from '@multiformats/multiaddr'
import {
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline'

import { connectToMultiaddr } from '../lib/libp2p'

import { useLibp2pContext } from '@/context/ctx'
import Spinner from '@/components/spinner'
import PeerList from '@/components/peer-list'
import { Dialog, DialogTitle, DialogBody } from '@/components/dialog'

export default function ConnectionPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { libp2p } = useLibp2pContext()
  const [connections, setConnections] = useState<Connection[]>([])
  const [listenAddresses, setListenAddresses] = useState<Multiaddr[]>([])
  const [maddr, setMultiaddr] = useState('')
  const [dialling, setDialling] = useState(false)
  const [err, setErr] = useState('')
  const [addressesExpanded, setAddressesExpanded] = useState(true)
  const [connectionsExpanded, setConnectionsExpanded] = useState(true)
  const [copiedAddress, setCopiedAddress] = useState<number | null>(null)
  const [copiedPeerId, setCopiedPeerId] = useState(false)

  useEffect(() => {
    const onConnection = () => {
      const connections = libp2p.getConnections()

      setConnections(connections)
    }

    onConnection()
    libp2p.addEventListener('connection:open', onConnection)
    libp2p.addEventListener('connection:close', onConnection)

    return () => {
      libp2p.removeEventListener('connection:open', onConnection)
      libp2p.removeEventListener('connection:close', onConnection)
    }
  }, [libp2p, setConnections])

  useEffect(() => {
    const onPeerUpdate = (evt: CustomEvent<PeerUpdate>) => {
      const maddrs = evt.detail.peer.addresses?.map((p) => p.multiaddr)

      setListenAddresses(maddrs ?? [])
    }

    libp2p.addEventListener('self:peer:update', onPeerUpdate)

    return () => {
      libp2p.removeEventListener('self:peer:update', onPeerUpdate)
    }
  }, [libp2p, setListenAddresses])

  const handleConnectToMultiaddr = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      setErr('')
      if (!maddr) {
        return
      }
      setDialling(true)
      try {
        await connectToMultiaddr(libp2p)(multiaddr(maddr))
      } catch (e: any) {
        setErr(e?.message ?? 'Error connecting')
      } finally {
        setDialling(false)
      }
    },
    [libp2p, maddr],
  )

  const handleMultiaddrChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setMultiaddr(e.target.value)
    },
    [setMultiaddr],
  )

  const toggleAddresses = () => {
    setAddressesExpanded(!addressesExpanded)
  }

  const toggleConnections = () => {
    setConnectionsExpanded(!connectionsExpanded)
  }

  const copyAddress = (index: number, address: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(index)
      setTimeout(() => setCopiedAddress(null), 2000)
    })
  }

  const copyPeerId = () => {
    navigator.clipboard.writeText(libp2p.peerId.toString()).then(() => {
      setCopiedPeerId(true)
      setTimeout(() => setCopiedPeerId(false), 2000)
    })
  }

  return (
    <Dialog open={isOpen} size="2xl" onClose={onClose}>
      <div className="flex justify-between items-center">
        <DialogTitle>Connection Information</DialogTitle>
        <button className="rounded-md text-gray-400 hover:text-gray-500" type="button" onClick={onClose}>
          <XMarkIcon aria-hidden="true" className="h-6 w-6" />
        </button>
      </div>
      <DialogBody>
        <div className="space-y-6 px-2">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900">This PeerID:</h3>
            <div className="mt-1 flex items-center bg-white p-2 rounded border border-gray-200">
              <p className="text-sm text-gray-700 break-all font-mono flex-grow">{libp2p.peerId.toString()}</p>
              <button
                className="ml-2 flex-shrink-0 text-gray-400 hover:text-gray-600"
                title="Copy PeerID"
                type="button"
                onClick={copyPeerId}
              >
                {copiedPeerId ? (
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <ClipboardIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div
              className="flex justify-between items-center cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors"
              onClick={toggleAddresses}
            >
              <h3 className="text-sm font-medium text-gray-900">Addresses ({listenAddresses.length}):</h3>
              <button
                aria-expanded={addressesExpanded}
                aria-label={addressesExpanded ? 'Collapse addresses' : 'Expand addresses'}
                className="text-gray-500 hover:text-gray-700"
                type="button"
              >
                {addressesExpanded ? (
                  <ChevronUpIcon aria-hidden="true" className="h-5 w-5" />
                ) : (
                  <ChevronDownIcon aria-hidden="true" className="h-5 w-5" />
                )}
              </button>
            </div>
            {addressesExpanded && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-white rounded border border-gray-200 p-2">
                {listenAddresses.length === 0 ? (
                  <p className="p-2 text-sm text-gray-500 italic">No addresses available</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {listenAddresses.map((ma, index) => (
                      <li
                        key={`ma-${index}`}
                        className="text-xs text-gray-700 font-mono p-2 flex justify-between items-center hover:bg-gray-50"
                      >
                        <span className="break-all mr-2">{ma.toString()}</span>
                        <button
                          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                          title="Copy address"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyAddress(index, ma.toString())
                          }}
                        >
                          {copiedAddress === index ? (
                            <ClipboardDocumentCheckIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <ClipboardIcon className="h-4 w-4" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!addressesExpanded && listenAddresses.length > 0 && (
              <p className="mt-2 text-xs text-gray-500 italic">Click to show {listenAddresses.length} addresses</p>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium leading-6 text-gray-900" htmlFor="peer-id">
              Multiaddr to connect to
            </label>
            <div className="mt-2">
              <input
                aria-describedby="multiaddr-id-description"
                className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                id="peer-id"
                name="peer-id"
                placeholder="12D3Koo..."
                type="text"
                value={maddr}
                onChange={handleMultiaddrChange}
              />
            </div>
            <button
              className={
                'rounded-md bg-indigo-600 mt-3 py-2 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600' +
                (dialling ? ' cursor-not-allowed' : '')
              }
              disabled={dialling}
              type="button"
              onClick={handleConnectToMultiaddr}
            >
              {dialling && <Spinner />} Connect{dialling && 'ing'} to multiaddr
            </button>
            {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
          </div>

          {connections.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div
                className="flex justify-between items-center cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors"
                onClick={toggleConnections}
              >
                <h3 className="text-sm font-medium text-gray-900">Connections ({connections.length}):</h3>
                <button
                  aria-expanded={connectionsExpanded}
                  aria-label={connectionsExpanded ? 'Collapse connections' : 'Expand connections'}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  {connectionsExpanded ? (
                    <ChevronUpIcon aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <ChevronDownIcon aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
              </div>
              {connectionsExpanded && (
                <div className="mt-2 max-h-60 overflow-y-auto bg-white rounded border border-gray-200 p-2">
                  <PeerList connections={connections} />
                </div>
              )}
              {!connectionsExpanded && (
                <p className="mt-2 text-xs text-gray-500 italic">Click to show {connections.length} connections</p>
              )}
            </div>
          )}
        </div>
      </DialogBody>
    </Dialog>
  )
}
