'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
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
import { ShieldAlert, Loader2, RefreshCw, UploadCloud, Sparkles, ImportIcon } from 'lucide-react'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'

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
  const [hasAcknowledged, setHasAcknowledged] = useState(false)
  const [showImportArea, setShowImportArea] = useState(false)

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
  const hexKey = storedKey ? `0x${uint8ArrayToString(uint8ArrayFromString(storedKey, 'base64pad'), 'hex')}` : undefined
  const buttonIsIconOnly = variant === 'icon'
  const iconOnlyContent = rotatingIdentity ? (
    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-default-500" strokeWidth={2} />
  ) : (
    <Sparkles aria-hidden className="h-4 w-4 text-default-600" strokeWidth={2} />
  )
  const buttonStartContent = rotatingIdentity ? (
    <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-default-500" strokeWidth={2} />
  ) : (
    <Sparkles aria-hidden className="h-3.5 w-3.5 text-default-500" strokeWidth={2} />
  )

  return (
    <>
      <Button
        aria-label="Manage identity"
        className={`h-12 !text-tiny px-6 rounded-sm font-normal text-background`}
        isDisabled={rotatingIdentity}
        isIconOnly={buttonIsIconOnly}
        radius="sm"
        size="sm"
        onPress={onOpen}
        color="primary"
        // startContent={buttonIsIconOnly ? undefined : buttonStartContent}
        variant="solid"
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
        size="3xl"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                <span id="new-identity-heading">Identity &amp; Keys</span>
              </ModalHeader>
              <ModalBody className="space-y-4 text-sm text-default-600">
                <div className="space-y-1">
                  <p className="font-semibold text-xs uppercase tracking-wide text-default-500">Current Peer ID</p>
                  <Snippet hideSymbol className="w-full px-3" codeString={peerIdString} size="sm" variant="flat">
                    <span className="break-all py-2 max-w-sm text-left whitespace-pre-wrap">{peerIdString}</span>
                  </Snippet>
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-xs uppercase tracking-wide text-default-500">
                    Reuse This Identity Later
                  </p>
                  <p className="text-[13px] text-default-500">
                    Love this peer ID? Copy its key into a password manager or secure note so you can import it again on
                    any device.
                  </p>
                  {hexKey ? (
                    <>
                      <div className="space-y-1 rounded-medium border border-default-200 bg-default-50 p-3 text-xs text-default-600">
                        <p className="font-semibold text-default-600">Backup pointers</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Show the key only when you&apos;re ready to copy.</li>
                          <li>Store it inside an encrypted manager or secure note.</li>
                          <li>Importing this key later restores this exact identity.</li>
                        </ul>
                      </div>
                      <Button
                        className="text-xs"
                        isDisabled={hasAcknowledged}
                        size="sm"
                        variant="flat"
                        onPress={() => setHasAcknowledged(true)}
                      >
                        {hasAcknowledged ? 'Ready to reveal' : 'I understand, show the key'}
                      </Button>
                      {hasAcknowledged && (
                        <Snippet hideSymbol className="w-full px-3 py-2" codeString={hexKey} size="sm" variant="flat">
                          <span className="break-all py-2 text-left whitespace-pre-wrap blur-sm hover:blur-none transition">
                            {hexKey}
                          </span>
                        </Snippet>
                      )}
                    </>
                  ) : (
                    <p className="text-default-500 text-xs">No stored key found yet.</p>
                  )}
                </div>

                <Divider />

                {showImportArea && (
                  <div className="space-y-2">
                    <p className="font-semibold text-xs uppercase tracking-wide text-default-500">Import a Saved Key</p>
                    <p className="text-[13px] text-default-500">
                      Paste any exported private key (they start with <code>0x</code>) and we&apos;ll sign you back in
                      as that peer. Perfect for keeping the same persona across browsers.
                    </p>
                    <Textarea
                      isDisabled={rotatingIdentity || importing}
                      maxRows={6}
                      minRows={3}
                      placeholder="Paste a private identity key here..."
                      value={importValue}
                      onChange={(e) => setImportValue(e.target.value)}
                    />
                    {importError && <p className="text-danger text-xs">{importError}</p>}
                    <div className="flex justify-start">
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
                        {importing ? 'Importing...' : 'Import Key'}
                      </Button>
                    </div>
                  </div>
                )}
                <Alert variant="bordered">
                  <p className="text-default-500 text-xs">
                    Rotating generates a fresh peer ID and disconnects active chats. Export the current key first if you
                    plan to come back as this persona.
                  </p>
                </Alert>
              </ModalBody>
              <ModalFooter>
                <div className="flex w-full justify-between">
                  <Button
                    className="text-default-500"
                    isDisabled={rotatingIdentity || importing}
                    size="sm"
                    variant="light"
                    onPress={onClose}
                  >
                    Close
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      isDisabled={rotatingIdentity || importing}
                      size="sm"
                      startContent={<ImportIcon className="h-3.5 w-3.5" strokeWidth={2} />}
                      variant="flat"
                      onPress={() => setShowImportArea((prev) => !prev)}
                    >
                      {showImportArea ? 'Hide Import' : 'Import Key'}
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
                      {rotatingIdentity ? 'Processing...' : 'New Identity'}
                    </Button>
                  </div>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
