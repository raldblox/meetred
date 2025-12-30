'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@heroui/react'

import { HelpModal, type Topic } from './help-modal'

const helpTopics: Topic[] = [
  { slug: 'network-basics', title: 'How libp2p works', description: 'Discovery, transports, relays, topics.' },
  { slug: 'dm-history', title: 'DM history & backfill', description: 'Who stores history and when it purges.' },
  { slug: 'security-privacy', title: 'Security & privacy', description: 'Signatures, storage, and encryption notes.' },
  { slug: 'faq-chat', title: 'Chat FAQ', description: 'Common chat/DM behavior questions.' },
  { slug: 'howto-troubleshoot', title: 'Troubleshooting', description: 'Connectivity steps and debug tips.' },
  { slug: 'identity', title: 'Identity & keys', description: 'Reuse, rotate, and recover your peer ID.' },
  { slug: 'messaging-architecture', title: 'Architecture diagram', description: 'How topics and envelopes route.' },
]

export function HelpLauncher({ compact = false }: { compact?: boolean }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpLoading, setHelpLoading] = useState(false)
  const [helpContent, setHelpContent] = useState('')
  const [activeHelp, setActiveHelp] = useState<string | null>('network-basics')

  const loadHelp = useCallback(async (slug: string) => {
    setHelpLoading(true)
    setActiveHelp(slug)

    try {
      const res = await fetch(`/api/docs/${slug}`)

      if (!res.ok) {
        throw new Error(`Failed to load ${slug}`)
      }

      const text = await res.text()

      setHelpContent(text)
    } catch (e) {
      setHelpContent('Unable to load content. Please try again.')
    } finally {
      setHelpLoading(false)
    }
  }, [])

  useEffect(() => {
    if (helpOpen && activeHelp) {
      loadHelp(activeHelp)
    }
  }, [activeHelp, helpOpen, loadHelp])

  return (
    <>
      <Button
        className={compact ? '!p-3 h-10 !text-tiny text-foreground bg-default-50 rounded-sm hover:bg-primary' : undefined}
        color="success"
        size="sm"
        variant="flat"
        onPress={() => {
          setHelpOpen(true)
          loadHelp(activeHelp ?? 'network-basics')
        }}
      >
        Guides
      </Button>
      <HelpModal
        activeSlug={activeHelp}
        content={helpContent}
        loading={helpLoading}
        open={helpOpen}
        topics={helpTopics}
        onClose={() => setHelpOpen(false)}
        onSelect={(slug) => {
          setHelpOpen(true)
          loadHelp(slug)
        }}
      />
    </>
  )
}
