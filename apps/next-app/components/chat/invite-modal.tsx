'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Snippet, useDisclosure } from '@heroui/react'
import { Check, Copy, UserPlus2 } from 'lucide-react'

import { useLibp2pContext } from '@/context/libp2p-ctx'

export function InviteButton() {
  const { libp2p } = useLibp2pContext()
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return ''
    }

    const url = new URL(window.location.href)

    url.searchParams.set('invite', libp2p.peerId.toString())

    return url.toString()
  }, [libp2p.peerId])

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return

    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setCopyError(null)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Copy failed. Please copy the link manually.')
    }
  }, [inviteLink])

  return (
    <>
      <Button
        aria-label="Invite to private chat"
        className="h-7 font-normal bg-default-100 text-sm text-default-600"
        size="sm"
        startContent={<UserPlus2 className="h-3.5 w-3.5" />}
        variant="flat"
        onPress={onOpen}
      >
        Invite
      </Button>

      <Modal
        aria-labelledby="invite-heading"
        backdrop="blur"
        isOpen={isOpen}
        placement="center"
        size="lg"
        onOpenChange={onOpenChange}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <UserPlus2 className="h-4 w-4" />
                <span id="invite-heading">Invite to Private Chat</span>
              </ModalHeader>
              <ModalBody className="space-y-4 text-sm text-default-600">
                <p>Share this link with a peer to open a direct message with you immediately.</p>
                <Snippet hideSymbol className="w-full py-2 px-3" codeString={inviteLink} size="sm" variant="flat">
                  <span className="break-all text-left whitespace-pre-wrap">{inviteLink}</span>
                </Snippet>
                {copyError && <p className="text-danger text-xs">{copyError}</p>}
              </ModalBody>
              <ModalFooter>
                <Button className="text-default-500" size="sm" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  startContent={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  variant="flat"
                  onPress={handleCopy}
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
