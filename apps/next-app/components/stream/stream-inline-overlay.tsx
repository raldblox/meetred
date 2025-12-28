'use client'

import type { ReactNode } from 'react'

import Link from 'next/link'
import { Modal, ModalBody, ModalContent, ModalHeader, Button } from '@heroui/react'

import { useStreamContext } from '@/context/stream-ctx'

interface StreamInlineOverlayProps {
  open: boolean
  onClose: () => void
  streamId: string
  children: ReactNode
}

export function StreamInlineOverlay({ open, onClose, streamId, children }: StreamInlineOverlayProps) {
  const { remoteStream } = useStreamContext()

  return (
    <Modal
      hideCloseButton
      isDismissable
      isOpen={open}
      placement="center"
      radius="sm"
      scrollBehavior="inside"
      size="4xl"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <ModalContent className="">
        {() => (
          <>
            <ModalHeader className="flex !px-4 pb-0 items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="uppercase tracking-wide text-default-500">Stream preview</span>
                {remoteStream ? (
                  <span className="rounded-full bg-success/10 px-2 py-1 text-[11px] font-semibold uppercase text-success">
                    Live
                  </span>
                ) : (
                  <span className="rounded-full bg-default-100 px-2 py-1 text-[11px] font-semibold uppercase text-default-500">
                    Waiting
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  as={Link}
                  color="primary"
                  href={`/stream/${streamId}`}
                  radius="full"
                  size="sm"
                  variant="solid"
                  onPress={onClose}
                >
                  Open full stream
                </Button>
              </div>
            </ModalHeader>
            <ModalBody className="pb-6 !p-4">
              <div className="w-full min-h-[260px] max-h-[70vh] overflow-hidden bg-default-50">{children}</div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
