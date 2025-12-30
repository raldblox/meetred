'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react'

export interface Topic {
  slug: string
  title: string
  description: string
}

interface HelpModalProps {
  open: boolean
  onClose: () => void
  topics: Topic[]
  activeSlug: string | null
  content: string
  loading: boolean
  onSelect: (slug: string) => void
}

export function HelpModal({ open, onClose, topics, activeSlug, content, loading, onSelect }: HelpModalProps) {
  const mdComponents = {
    h1: (props: any) => <h1 className="text-lg font-bold text-default-900 mb-3" {...props} />,
    h2: (props: any) => <h2 className="text-base font-semibold text-default-800 mt-4 mb-2" {...props} />,
    h3: (props: any) => <h3 className="text-sm font-semibold text-default-800 mt-3 mb-1.5" {...props} />,
    p: (props: any) => <p className="text-sm text-default-700 leading-relaxed mb-2" {...props} />,
    ul: (props: any) => <ul className="list-disc pl-5 space-y-1 text-sm text-default-700 mb-2" {...props} />,
    ol: (props: any) => <ol className="list-decimal pl-5 space-y-1 text-sm text-default-700 mb-2" {...props} />,
    li: (props: any) => <li className="text-sm text-default-700 leading-relaxed" {...props} />,
    code: (props: any) => <code className="rounded px-1.5 py-0.5 text-xs font-mono text-default-800" {...props} />,
    pre: (props: any) => (
      <pre
        className="rounded-lg bg-default-100 p-3 text-xs font-mono text-default-800 overflow-auto mb-3 border border-default-200"
        {...props}
      />
    ),
    a: (props: any) => (
      <a className="text-primary underline underline-offset-2 hover:text-primary-600" target="_blank" {...props} />
    ),
  }

  return (
    <Modal isOpen={open} onOpenChange={(next) => (!next ? onClose() : null)} size="5xl" scrollBehavior="inside">
      <ModalContent className="p-0 overflow-hidden">
        <ModalHeader className="px-6 py-4 border-b border-default-200">
          <div>
            <p className="text-xs uppercase tracking-wide text-default-500">Help & Guides</p>
            <p className="text-sm text-default-700">Learn how chat, DMs, history, and libp2p work.</p>
          </div>
        </ModalHeader>
        <ModalBody className="p-0">
          <div className="flex h-[65vh] w-full">
            <div className="w-64 border-r border-default-200 bg-default-50 p-4 space-y-2">
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
            <div className="flex-1 overflow-auto p-6">
              {loading ? (
                <p className="text-sm text-default-500">Loading…</p>
              ) : (
                <article className="max-w-none">
                  <ReactMarkdown components={mdComponents as any} remarkPlugins={[remarkGfm]}>
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
