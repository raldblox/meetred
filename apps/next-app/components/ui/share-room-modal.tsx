'use client'

import React, { useMemo } from 'react'
import { Button, Modal, ModalBody, ModalContent, ModalHeader, Snippet } from '@heroui/react'
import { Facebook, Linkedin } from 'lucide-react'

import { TwitterIcon } from './icons'

import { SHARE_COPY, type RoomType, type SharePlatform } from '@/config/share'

interface ShareRoomModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  shareUrl: string
  roomType: RoomType
  title?: string
  subtitle?: string
  showQrCode?: boolean
}

export function ShareRoomModal({
  isOpen,
  onOpenChange,
  shareUrl,
  roomType,
  title = 'Share room',
  subtitle = 'Send this link to invite people in.',
  showQrCode = false,
}: ShareRoomModalProps) {
  const encodedUrl = useMemo(() => encodeURIComponent(shareUrl || ''), [shareUrl])

  const getCopy = (platform: SharePlatform) => {
    const platformCopy = SHARE_COPY[roomType]?.[platform]

    if (platformCopy) return platformCopy

    return SHARE_COPY[roomType]?.generic ?? SHARE_COPY.public.generic
  }

  const buildShareText = (platform: SharePlatform) => {
    const copy = getCopy(platform)

    return `${copy.title}\n\n${copy.description}\n\n${shareUrl || ''}`.trim()
  }

  const previewCopy = getCopy('generic')
  const genericShareText = buildShareText('generic')

  const socialTargets = [
    {
      name: 'Share on X',
      href: shareUrl ? `https://x.com/intent/post?text=${encodeURIComponent(buildShareText('twitter'))}` : undefined,
      icon: <TwitterIcon className="h-4 w-4" />,
    },
    {
      name: 'Share on LinkedIn',
      href: shareUrl
        ? `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodeURIComponent(getCopy('linkedin').title)}&summary=${encodeURIComponent(getCopy('linkedin').description)}`
        : undefined,
      icon: <Linkedin className="h-4 w-4" />,
    },
    {
      name: 'Share on Facebook',
      href: shareUrl
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(buildShareText('facebook'))}`
        : undefined,
      icon: <Facebook className="h-4 w-4" />,
    },
  ]

  return (
    <Modal
      aria-labelledby="share-room-modal"
      hideCloseButton={false}
      isOpen={isOpen}
      placement="center"
      size="sm"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col items-start gap-1">
              <p className="text-[11px] uppercase tracking-[0.3em] text-default-400">Ready to share</p>
              <h2 className="text-lg font-semibold text-default-900">{title}</h2>
              {/* <p className="text-xs text-default-500">{subtitle}</p> */}
            </ModalHeader>
            <ModalBody className="pb-6 pt-0 space-y-4">
              {/* <div className="rounded-2xl border border-default-100 bg-gradient-to-r from-primary-500/10 via-secondary-500/5 to-background p-4 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.25em] text-default-500">Share preview</p>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-semibold text-default-900">{previewCopy.title}</p>
                  <p className="text-xs text-default-600">{previewCopy.description}</p>
                  <p className="text-[11px] text-default-400 break-all">{shareUrl || 'Preparing link...'}</p>
                </div>
              </div> */}

              {/* {showQrCode ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-default-200 p-3">
                  {shareUrl ? (
                    <div className="rounded-xl border border-default-100 bg-white p-3">
                      <ReactQRCode className="h-32 w-32" value={shareUrl} />
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-default-100 bg-default-100 text-[10px] uppercase tracking-[0.2em] text-default-500">
                      Linking...
                    </div>
                  )}
                  <p className="text-[11px] text-default-500">Scan to hop in quickly</p>
                </div>
              ) : null} */}

              <div className="space-y-2">
                <div className="grid gap-2">
                  {socialTargets.map((target) => (
                    <Button
                      key={target.name}
                      as="a"
                      className="justify-start"
                      color="primary"
                      href={target.href}
                      isDisabled={!target.href}
                      radius="sm"
                      rel="noreferrer"
                      startContent={target.icon}
                      target="_blank"
                      variant="solid"
                    >
                      {target.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.25em] text-default-500">ROOM LINK</p>
                <Snippet
                  hideSymbol
                  className="w-full px-3 py-2"
                  codeString={shareUrl}
                  color="default"
                  hideCopyButton={!shareUrl}
                  size="sm"
                  variant="bordered"
                >
                  <span className="break-all whitespace-pre-wrap text-left text-xs">
                    {shareUrl || 'Waiting for link...'}
                  </span>
                </Snippet>
              </div>
            </ModalBody>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
