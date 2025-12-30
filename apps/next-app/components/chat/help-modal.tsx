'use client'

import React, { type ComponentProps } from 'react'
import ReactMarkdown, { type Components as MarkdownComponents } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Modal, ModalBody, ModalContent, ModalHeader, Tabs, Tab } from '@heroui/react'

export interface Topic {
  slug: string
  title: string
  description: string
  audience: 'user' | 'developer'
}

interface HelpModalProps {
  open: boolean
  onClose: () => void
  topics: Topic[]
  activeSlug: string | null
  content: string
  loading: boolean
  onSelect: (slug: string) => void
  audience: 'user' | 'developer'
  onAudienceChange: (audience: 'user' | 'developer') => void
}

export function HelpModal({
  open,
  onClose,
  topics,
  activeSlug,
  content,
  loading,
  onSelect,
  audience,
  onAudienceChange,
}: HelpModalProps) {
  const subtitle =
    audience === 'user'
      ? 'Quick answers and guides for using Meetred.'
      : 'Technical docs for identity, networking, and integrations.'

  const mdComponents: MarkdownComponents = {
    h1: ({ children, ...props }: ComponentProps<'h1'>) => (
      <h1 className="text-lg font-bold text-default-900 mb-3" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: ComponentProps<'h2'>) => (
      <h2 className="text-base font-semibold text-default-800 mt-4 mb-2" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: ComponentProps<'h3'>) => (
      <h3 className="text-sm font-semibold text-default-800 mt-3 mb-1.5" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }: ComponentProps<'p'>) => (
      <p className="text-sm text-default-700 leading-relaxed mb-2" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }: ComponentProps<'ul'>) => (
      <ul className="list-disc pl-5 space-y-1 text-sm text-default-700 mb-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: ComponentProps<'ol'>) => (
      <ol className="list-decimal pl-5 space-y-1 text-sm text-default-700 mb-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: ComponentProps<'li'>) => (
      <li className="text-sm text-default-700 leading-relaxed" {...props}>
        {children}
      </li>
    ),
    code: ({ children, ...props }: ComponentProps<'code'>) => (
      <code className="rounded px-1.5 py-0.5 text-xs font-mono text-default-800 bg-default-200" {...props}>
        {children}
      </code>
    ),
    pre: ({ children, ...props }: ComponentProps<'pre'>) => (
      <pre
        className="rounded-lg bg-default-100 p-3 text-xs font-mono text-default-800 overflow-auto mb-3 border border-default-200"
        {...props}
      >
        {children}
      </pre>
    ),
    a: ({ children, ...props }: ComponentProps<'a'>) => (
      <a
        className="text-primary underline underline-offset-2 hover:text-primary-600"
        rel="noreferrer noopener"
        target="_blank"
        {...props}
      >
        {children}
      </a>
    ),
  }

  return (
    <Modal
      isOpen={open}
      scrollBehavior="inside"
      size="5xl"
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <ModalContent className="p-0 overflow-hidden">
        <ModalHeader className="px-6 py-4 border-b border-default-200">
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-default-500">Help & Guides</p>
              <p className="text-sm text-default-700">{subtitle}</p>
            </div>
            <Tabs
              aria-label="Help audience"
              color="success"
              size="sm"
              selectedKey={audience}
              variant="solid"
              onSelectionChange={(key) => onAudienceChange(key as 'user' | 'developer')}
            >
              <Tab key="user" title="User" />
              <Tab key="developer" title="Developer" />
            </Tabs>
          </div>
        </ModalHeader>
        <ModalBody className="p-0">
          <div className="flex h-[65vh] w-full">
            <div className="w-72 border-r border-default-200 bg-default-50 flex flex-col" data-help-scroll>
              <div className="p-4 space-y-2 border-b border-default-200">
                <div className="flex gap-2">
                  <Button
                    className="text-xs"
                    color={audience === 'user' ? 'success' : 'default'}
                    size="sm"
                    variant={audience === 'user' ? 'flat' : 'light'}
                    onPress={() => onAudienceChange('user')}
                  >
                    User
                  </Button>
                  <Button
                    className="text-xs"
                    color={audience === 'developer' ? 'success' : 'default'}
                    size="sm"
                    variant={audience === 'developer' ? 'flat' : 'light'}
                    onPress={() => onAudienceChange('developer')}
                  >
                    Developer
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {topics.map((topic) => (
                  <button
                    key={topic.slug}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary/60 hover:bg-primary/5 ${
                      activeSlug === topic.slug
                        ? 'border-primary bg-primary/10 text-primary-800'
                        : 'border-default-200 text-default-700'
                    }`}
                    onClick={() => onSelect(topic.slug)}
                  >
                    <div className="font-semibold">{topic.title}</div>
                    <div className="text-[11px] text-default-500">{topic.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6" data-help-scroll>
              {loading ? (
                <p className="text-sm text-default-500">Loading...</p>
              ) : (
                <article className="max-w-none">
                  <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}
