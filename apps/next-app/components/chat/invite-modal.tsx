'use client'

import type { ReactNode } from 'react'

import { useCallback, useMemo, useState } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Snippet, useDisclosure } from '@heroui/react'
import { UserPlus2 } from 'lucide-react'

import { useLibp2pContext } from '@/context/libp2p-ctx'
import { UI_COPY } from '@/config/copy'

interface InviteButtonProps {
  label?: string
  className?: string
  ariaLabel?: string
  size?: 'sm' | 'md' | 'lg'
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  variant?: 'solid' | 'flat' | 'light' | 'ghost' | 'bordered'
  startContent?: ReactNode
}

export function InviteButton({
  label = UI_COPY.nav.invite,
  className = '!p-3 h-10 bg-default-50 rounded-sm font-normal !text-tiny text-primary hover:text-background hover:bg-primary',
  ariaLabel = 'Invite to private chat',
  size = 'sm',
  radius = 'sm',
  variant = 'solid',
  startContent,
}: InviteButtonProps) {
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
        aria-label={ariaLabel}
        className={className}
        color="primary"
        radius={radius}
        size={size}
        startContent={startContent}
        variant={variant}
        onPress={onOpen}
      >
        {label}
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
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}
