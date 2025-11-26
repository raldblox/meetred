'use client'

import type { PeerUpdate, Connection } from '@libp2p/interface'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Multiaddr, multiaddr } from '@multiformats/multiaddr'
import {
  Accordion,
  AccordionItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Snippet,
  useDraggable,
} from '@heroui/react'

import { connectToMultiaddr } from '../lib/libp2p'

import { useLibp2pContext } from '@/context/ctx'
import Spinner from '@/components/spinner'
import PeerList from '@/components/peer-list'

export default function ConnectionPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { libp2p } = useLibp2pContext()
  const [connections, setConnections] = useState<Connection[]>([])
  const [listenAddresses, setListenAddresses] = useState<Multiaddr[]>([])
  const [maddr, setMultiaddr] = useState('')
  const [dialling, setDialling] = useState(false)
  const [err, setErr] = useState('')

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
    async (_e: React.MouseEvent<HTMLButtonElement>) => {
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

  const targetRef = useRef(null)
  const { moveProps } = useDraggable({ targetRef, isDisabled: !isOpen })

  return (
    <Modal
      ref={targetRef}
      draggable
      backdrop="transparent"
      isDismissable={true}
      isOpen={isOpen}
      placement="center"
      scrollBehavior="inside"
      size="3xl"
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <ModalContent className="">
        {() => (
          <>
            <ModalHeader
              {...moveProps}
              className="flex items-center justify-between gap-4 border-b border-default-100 px-4 py-3"
            >
              <h3 className="text-base font-semibold uppercase tracking-wide text-default-900">
                Connection Information
              </h3>
            </ModalHeader>
            <ModalBody className="space-y-6 px-2 pb-6 pt-6 sm:px-4 sm:pb-8">
              <div className="bg-default-50 p-4 rounded-lg space-y-2">
                <h3 className="text-sm font-medium text-default-900">Your PeerID:</h3>
                <Snippet hideSymbol className="w-full" codeString={libp2p.peerId.toString()}>
                  {libp2p.peerId.toString()}
                </Snippet>
              </div>
              <Accordion
                className="px-0"
                defaultExpandedKeys={['addresses', 'connections']}
                selectionMode="multiple"
                variant="splitted"
              >
                <AccordionItem key="addresses" aria-label="addresses" title={`Addresses (${listenAddresses.length})`}>
                  {listenAddresses.length === 0 ? (
                    <p className="text-sm text-default-500 italic">No addresses available</p>
                  ) : (
                    <div className="space-y-3">
                      {listenAddresses.map((ma, index) => (
                        <Snippet
                          key={`ma-${index}`}
                          hideSymbol
                          className="w-full"
                          codeString={ma.toString()}
                          color="default"
                        >
                          {ma.toString()}
                        </Snippet>
                      ))}
                    </div>
                  )}
                </AccordionItem>
                <AccordionItem key="connections" aria-label="connections" title={`Connections (${connections.length})`}>
                  {connections.length === 0 ? (
                    <p className="text-sm text-default-500 italic">No connections yet</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto rounded border border-default-200 p-2 bg-background">
                      <PeerList connections={connections} />
                    </div>
                  )}
                </AccordionItem>
              </Accordion>
              <div className="bg-background p-4 rounded-lg border border-default-200">
                <label className="block text-sm font-medium leading-6 text-default-900" htmlFor="peer-id">
                  Multiaddr to connect to
                </label>
                <div className="mt-2">
                  <input
                    aria-describedby="multiaddr-id-description"
                    className="block w-full rounded-md border-0 py-1.5 px-3 text-default-900 shadow-sm ring-1 ring-inset ring-default-300 placeholder:text-default-400 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
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
                    'rounded-md bg-primary mt-3 py-2 px-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' +
                    (dialling ? ' cursor-not-allowed' : '')
                  }
                  disabled={dialling}
                  type="button"
                  onClick={handleConnectToMultiaddr}
                >
                  {dialling && <Spinner />} Connect{dialling && 'ing'} to multiaddr
                </button>
                {err && <p className="mt-2 text-sm text-danger">{err}</p>}
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
