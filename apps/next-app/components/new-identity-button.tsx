'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Snippet,
  Textarea,
  useDisclosure,
} from '@heroui/react'
import { ShieldAlert, Loader2, RefreshCw, UploadCloud } from 'lucide-react'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { exportStoredPrivateKey } from '@/lib/identity'

interface NewIdentityButtonProps {
  variant?: 'full' | 'icon'
}

export function NewIdentityButton({ variant = 'full' }: NewIdentityButtonProps) {
  const { libp2p, createNewIdentity, importIdentity, rotatingIdentity } = useLibp2pContext()
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()
  const mountedRef = useRef(true)
  const [storedKey, setStoredKey] = useState<string | undefined>()
  const [importValue, setImportValue] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)

  const refreshStoredKey = useCallback(() => {
    setStoredKey(exportStoredPrivateKey())
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      refreshStoredKey()
    }
  }, [isOpen, refreshStoredKey, rotatingIdentity])

  const handleConfirm = useCallback(async () => {
    try {
      await createNewIdentity()
      if (mountedRef.current) {
        refreshStoredKey()
        onClose()
      }
    } catch (error) {
      if (mountedRef.current) {
        setImportError(error instanceof Error ? error.message : 'Failed to rotate identity')
      }
    }
  }, [createNewIdentity, onClose, refreshStoredKey])

  const handleImport = useCallback(async () => {
    if (!importValue.trim()) {
      setImportError('Please paste a private key before importing.')

      return
    }

    setImportError('')
    setImporting(true)

    try {
      await importIdentity(importValue.trim())
      setImportValue('')
      refreshStoredKey()
    } catch (error: any) {
      setImportError(error?.message ?? 'Failed to import identity')
    } finally {
      setImporting(false)
    }
  }, [importIdentity, importValue, refreshStoredKey])

  const peerIdString = libp2p.peerId.toString()
  const buttonIsIconOnly = variant === 'icon'
  const iconOnlyContent = rotatingIdentity ? (
    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-default-500" strokeWidth={2} />
  ) : (
    <RefreshCw aria-hidden className="h-4 w-4 text-default-600" strokeWidth={2} />
  )
  const buttonStartContent = rotatingIdentity ? (
    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-default-500" strokeWidth={2} />
  ) : (
    <RefreshCw aria-hidden className="h-3.5 w-3.5 text-default-500" strokeWidth={2} />
  )

  return (
    <>
      <Button
        aria-label="Manage identity"
        className={`h-7 font-normal bg-default-100 ${buttonIsIconOnly ? 'text-default-600' : 'text-sm text-default-600'}`}
        isDisabled={rotatingIdentity}
        isIconOnly={buttonIsIconOnly}
        size="sm"
        startContent={buttonIsIconOnly ? undefined : buttonStartContent}
        variant="flat"
        onPress={onOpen}
      >
        {buttonIsIconOnly ? iconOnlyContent : 'Identity'}
      </Button>

      <Modal
        aria-labelledby="new-identity-heading"
        backdrop="blur"
        isDismissable={!rotatingIdentity && !importing}
        isKeyboardDismissDisabled={rotatingIdentity || importing}
        isOpen={isOpen}
        placement="center"
        size="lg"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" />
                <span id="new-identity-heading">Identity &amp; Keys</span>
              </ModalHeader>
              <ModalBody className="space-y-4 text-sm text-default-600">
                <div className="space-y-1">
                  <p className="font-semibold text-xs uppercase tracking-wide text-default-500">Current Peer ID</p>
                  <Snippet hideSymbol className="w-full" codeString={peerIdString} size="sm" variant="flat">
                    <span className="break-all max-w-sm text-left whitespace-pre-wrap">{peerIdString}</span>
                  </Snippet>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-xs uppercase tracking-wide text-default-500">Private Key (base64)</p>
                  {storedKey ? (
                    <Snippet hideSymbol className="w-full" codeString={storedKey} size="sm" variant="flat">
                      <span className="break-all text-left whitespace-pre-wrap">{storedKey}</span>
                    </Snippet>
                  ) : (
                    <p className="text-default-500 text-xs">No stored key found yet.</p>
                  )}
                </div>

                <Divider />

                <div className="space-y-2">
                  <p className="font-semibold text-xs uppercase tracking-wide text-default-500">Import Private Key</p>
                  <Textarea
                    isDisabled={rotatingIdentity || importing}
                    maxRows={6}
                    minRows={3}
                    placeholder="Paste a base64 protobuf private key here..."
                    value={importValue}
                    onChange={(e) => setImportValue(e.target.value)}
                  />
                  {importError && <p className="text-danger text-xs">{importError}</p>}
                  <div className="flex justify-end">
                    <Button
                      color="primary"
                      isDisabled={rotatingIdentity || importing}
                      size="sm"
                      startContent={
                        importing ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                        ) : (
                          <UploadCloud aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        )
                      }
                      variant="flat"
                      onPress={handleImport}
                    >
                      {importing ? 'Importing…' : 'Import Key'}
                    </Button>
                  </div>
                </div>

                <p className="text-default-500 text-xs">
                  Regenerating a new identity wipes the stored key, disconnects current peers, and restarts the node
                  with a fresh Ed25519 key pair.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  aria-label="Close identity modal"
                  className="text-default-500"
                  isDisabled={rotatingIdentity || importing}
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Close
                </Button>
                <Button
                  color="danger"
                  isDisabled={rotatingIdentity || importing}
                  size="sm"
                  startContent={
                    rotatingIdentity ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <RefreshCw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
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
