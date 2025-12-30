'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@heroui/react'
import { CircleHelp } from 'lucide-react'

import { HelpModal, type Topic } from './help-modal'

type Audience = 'user' | 'developer'

const userTopics: Topic[] = [
  { slug: 'user-overview', title: 'Overview', description: 'Where to start and what Meetred is.', audience: 'user' },
  { slug: 'user-start', title: 'Start here', description: 'Get started in 60 seconds.', audience: 'user' },
  { slug: 'user-faq', title: 'FAQ', description: 'Quick answers to common questions.', audience: 'user' },
  { slug: 'user-public', title: 'Public room', description: 'How the lobby chat works.', audience: 'user' },
  { slug: 'user-dms', title: 'Direct messages', description: 'Private chats and how history works.', audience: 'user' },
  {
    slug: 'user-identity',
    title: 'Identity',
    description: 'Back up, rotate, or move your identity.',
    audience: 'user',
  },
  { slug: 'user-streams', title: 'Streams', description: 'Host and watch streams with chat.', audience: 'user' },
  {
    slug: 'user-calls',
    title: 'Calls',
    description: 'Start and join private audio and video calls.',
    audience: 'user',
  },
  { slug: 'user-ai', title: 'AI rooms', description: 'Chat with an AI hosted by the room owner.', audience: 'user' },
  {
    slug: 'user-payments',
    title: 'Payments',
    description: 'Paid minutes and tips, explained simply.',
    audience: 'user',
  },
  { slug: 'user-safety', title: 'Safety', description: 'Public vs private and best practices.', audience: 'user' },
  { slug: 'user-troubleshoot', title: 'Troubleshooting', description: 'Fix common issues fast.', audience: 'user' },
  { slug: 'user-glossary', title: 'Glossary', description: 'Key terms in plain language.', audience: 'user' },
]

const devTopics: Topic[] = [
  {
    slug: 'dev-overview',
    title: 'Developer overview',
    description: 'Architecture, data flow, and core concepts.',
    audience: 'developer',
  },
  {
    slug: 'dev-tech-stack',
    title: 'Tech stack',
    description: 'Frameworks, libraries, and services used.',
    audience: 'developer',
  },
  {
    slug: 'dev-architecture',
    title: 'Architecture',
    description: 'How the app, rooms, and identity fit together.',
    audience: 'developer',
  },
  {
    slug: 'dev-networking',
    title: 'Networking',
    description: 'libp2p, discovery, relays, and media transport.',
    audience: 'developer',
  },
  {
    slug: 'dev-history',
    title: 'Message history',
    description: 'Local storage, retention, and backfill behavior.',
    audience: 'developer',
  },
  {
    slug: 'dev-security',
    title: 'Security model',
    description: 'Signing, encryption, and system boundaries.',
    audience: 'developer',
  },
  {
    slug: 'dev-ai',
    title: 'AI integration',
    description: 'Local model hosting and API-based models.',
    audience: 'developer',
  },
  {
    slug: 'dev-retention',
    title: 'Data retention',
    description: 'What is stored where and for how long.',
    audience: 'developer',
  },
  {
    slug: 'dev-threat',
    title: 'Threat model',
    description: 'Assumptions and adversaries for auditing.',
    audience: 'developer',
  },
  {
    slug: 'dev-open',
    title: 'Open questions',
    description: 'Known gaps and future work areas.',
    audience: 'developer',
  },
]

export function HelpLauncher({ compact = false }: { compact?: boolean }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [helpLoading, setHelpLoading] = useState(false)
  const [helpContent, setHelpContent] = useState('')
  const [activeHelp, setActiveHelp] = useState<string | null>('user-overview')
  const [audience, setAudience] = useState<Audience>('user')

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

  useEffect(() => {
    if (!helpOpen) {
      const scrollers = document.querySelectorAll('[data-help-scroll]')
      scrollers.forEach((el) => {
        if (el instanceof HTMLElement) el.scrollTop = 0
      })
    }
  }, [helpOpen])

  const filteredTopics = useMemo(() => {
    return audience === 'user' ? userTopics : devTopics
  }, [audience])

  useEffect(() => {
    if (!filteredTopics.find((t) => t.slug === activeHelp)) {
      const fallback = filteredTopics[0]?.slug
      if (fallback) {
        setActiveHelp(fallback)
        if (helpOpen) {
          loadHelp(fallback)
        }
      }
    }
  }, [activeHelp, filteredTopics, helpOpen, loadHelp])
  return (
    <>
      <Button
        className={
          compact ? '!p-3 h-10 !text-tiny text-foreground bg-default-50 rounded-sm hover:bg-primary' : undefined
        }
        color="success"
        size="sm"
        variant="flat"
        onPress={() => {
          setHelpOpen(true)
          loadHelp(activeHelp ?? 'user-overview')
        }}
        startContent={<CircleHelp className="h-4 w-4" />}
      >
        Help
      </Button>
      <HelpModal
        activeSlug={activeHelp}
        audience={audience}
        content={helpContent}
        loading={helpLoading}
        open={helpOpen}
        topics={filteredTopics}
        onAudienceChange={setAudience}
        onClose={() => setHelpOpen(false)}
        onSelect={(slug) => {
          setHelpOpen(true)
          loadHelp(slug)
        }}
      />
    </>
  )
}
