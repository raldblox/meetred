'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Alert, Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from '@heroui/react'
import { ShieldAlert, RefreshCw, Loader2, BrushCleaning, WandSparkles, BrushCleaningIcon, Brush } from 'lucide-react'

import { useLibp2pContext } from '@/context/libp2p-ctx'

export function NewIdentityButton() {
  const { createNewIdentity, rotatingIdentity } = useLibp2pContext()
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleConfirm = useCallback(async () => {
    try {
      await createNewIdentity()
      if (mountedRef.current) {
        onClose()
      }
    } catch {
      if (mountedRef.current) {
        onClose()
      }
    }
  }, [createNewIdentity, onClose])

  return (
    <>
      <Button
        className="text-sm h-7 font-normal text-default-600 bg-default-100"
        isDisabled={rotatingIdentity}
        size="sm"
        startContent={
          rotatingIdentity ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-default-500" strokeWidth={2} />
          ) : (
            <WandSparkles size={14} />
          )
        }
        variant="flat"
        onPress={onOpen}
      >
        New Identity
      </Button>

      <Modal
        aria-labelledby="new-identity-heading"
        backdrop="blur"
        isDismissable={!rotatingIdentity}
        isKeyboardDismissDisabled={rotatingIdentity}
        isOpen={isOpen}
        placement="center"
        size="md"
        onOpenChange={() => {
          if (!rotatingIdentity) {
            onOpenChange()
          }
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" />
                <span id="new-identity-heading">New Identity</span>
              </ModalHeader>
              <ModalBody className="space-y-3 text-sm text-default-600">
                <Alert color="warning">
                  Starting a new identity will wipe your persistent peer ID, disconnect active peers, and restart the
                  libp2p node with a fresh key pair. This will give you a clean slate.
                </Alert>
                <Alert color="default">
                  All chats and pending direct messages will reload once the new node is ready.
                </Alert>
              </ModalBody>
              <ModalFooter>
                <Button
                  aria-label="Cancel new identity request"
                  className="text-default-500"
                  isDisabled={rotatingIdentity}
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isDisabled={rotatingIdentity}
                  size="sm"
                  startContent={
                    rotatingIdentity ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <WandSparkles size={14} />
                    )
                  }
                  onPress={handleConfirm}
                >
                  {rotatingIdentity ? 'Creating…' : 'Create New Identity'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
