'use client'

import type { PeerUpdate, Connection } from '@libp2p/interface'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Multiaddr, multiaddr } from '@multiformats/multiaddr'
import {
  Accordion,
  AccordionItem,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ScrollShadow,
  Snippet,
  Spinner,
  useDraggable,
} from '@heroui/react'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import PeerList from '@/components/peer-list'
import { BOOTSTRAP_PEER_IDS } from '@/lib/constants'
import { connectToMultiaddr } from '@/lib/libp2p'

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

  const filteredConnections = connections.filter(
    (connection) => !BOOTSTRAP_PEER_IDS.includes(connection.remotePeer.toString()),
  )

  return (
    <Modal
      ref={targetRef}
      draggable
      backdrop="opaque"
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
            <ModalHeader {...moveProps} className="flex items-center justify-between gap-4 border-b border-default-100">
              <h3 className="text-base font-semibold uppercase tracking-wide text-default-900">Network Information</h3>
            </ModalHeader>
            <ModalBody className="space-y-6 py-6">
              <div className="bg-default-50 rounded-lg space-y-2">
                <h3 className="text-sm font-medium text-default-900">Your PeerID:</h3>
                <Snippet
                  hideSymbol
                  className="w-full"
                  codeString={libp2p.peerId.toString()}
                  color="default"
                  variant="flat"
                >
                  <span className="break-all max-w-sm text-left whitespace-pre-wrap">{libp2p.peerId.toString()}</span>
                </Snippet>
              </div>
              <Accordion
                className="px-0"
                // defaultExpandedKeys={['addresses', 'connections']}
                itemClasses={{ content: 'pb-4', title: 'text-sm' }}
                selectionMode="multiple"
                variant="splitted"
              >
                <AccordionItem key="addresses" aria-label="addresses" title={`Addresses (${listenAddresses.length})`}>
                  {listenAddresses.length === 0 ? (
                    <p className="text-sm text-default-500 italic">No addresses available</p>
                  ) : (
                    <ScrollShadow className="space-y-3 rounded-lg max-h-[30vh] overflow-y-auto">
                      {listenAddresses.map((ma, index) => (
                        <Snippet
                          key={`ma-${index}`}
                          hideSymbol
                          className="w-full"
                          codeString={ma.toString()}
                          color="default"
                          variant="flat"
                        >
                          <span className="break-all text-xs max-w-sm text-left whitespace-pre-wrap">
                            {ma.toString()}
                          </span>
                        </Snippet>
                      ))}
                    </ScrollShadow>
                  )}
                </AccordionItem>
                <AccordionItem
                  key="connections"
                  aria-label="connections"
                  title={
                    <div className="flex items-center gap-2">
                      <span>Connections</span>
                      <span>({filteredConnections.length})</span>
                    </div>
                  }
                >
                  {filteredConnections.length === 0 ? (
                    <p className="text-sm text-default-500 italic">No connections yet</p>
                  ) : (
                    <ScrollShadow className="space-y-3 rounded-lg max-h-[30vh] overflow-y-auto">
                      <PeerList connections={filteredConnections} />
                    </ScrollShadow>
                  )}
                </AccordionItem>
                <AccordionItem
                  key="bootstraps"
                  aria-label="bootstraps"
                  title={
                    <div className="flex items-center gap-2">
                      <span>Bootstrap Peers</span>
                      <span>({BOOTSTRAP_PEER_IDS.length})</span>
                    </div>
                  }
                >
                  <ScrollShadow className="space-y-3 rounded-lg max-h-[30vh] overflow-y-auto">
                    {BOOTSTRAP_PEER_IDS.map((peerId) => (
                      <Snippet
                        key={peerId}
                        hideSymbol
                        className="w-full"
                        codeString={peerId}
                        color="default"
                        variant="flat"
                      >
                        <span className="flex items-center break-all text-xs text-left whitespace-pre-wrap">
                          {peerId}
                        </span>
                      </Snippet>
                    ))}
                  </ScrollShadow>
                </AccordionItem>
              </Accordion>

              <Divider />
              <div className="flex w-full flex-col gap-3">
                <Input
                  aria-describedby="multiaddr-id-description"
                  id="peer-id"
                  label="Connect to multiaddr"
                  labelPlacement="outside-top"
                  name="peer-id"
                  placeholder="12D3Koo..."
                  type="text"
                  value={maddr}
                  onChange={handleMultiaddrChange}
                />

                <button
                  className={
                    'rounded-md w-fit bg-primary py-2 px-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary' +
                    (dialling ? ' cursor-not-allowed' : '')
                  }
                  disabled={dialling}
                  type="button"
                  onClick={handleConnectToMultiaddr}
                >
                  {dialling && <Spinner />} Connect{dialling && 'ing'}
                </button>
                {err && <p className="mt-2 text-sm text-danger">{err}</p>}
              </div>
            </ModalBody>
            {/* <ModalFooter className="w-full">
              
            </ModalFooter> */}
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
