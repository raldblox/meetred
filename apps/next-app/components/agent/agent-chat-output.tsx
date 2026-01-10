'use client'

import type { LLMOutputComponent } from '@llm-ui/react'
import type { ComponentType } from 'react'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Chip } from '@heroui/react'
import { useLLMOutput, throttleBasic } from '@llm-ui/react'
import { markdownLookBack } from '@llm-ui/markdown'
import { findCompleteJsonBlock, findPartialJsonBlock, jsonBlockLookBack, parseJson5 } from '@llm-ui/json'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { AGENT_BUTTONS_BLOCK_OPTIONS } from '@/lib/agent-ui'

type AgentChatOutputProps = {
  text: string
  onActionPrompt?: (prompt: string) => void
}

type ButtonsBlockData = {
  type?: string
  title?: string
  buttons?: Array<{ text?: string; prompt?: string }>
}

const throttle = throttleBasic({
  readAheadChars: 12,
  targetBufferChars: 10,
  adjustPercentage: 0.3,
  frameLookBackMs: 9000,
  windowLookBackMs: 1500,
})

const stripThinkingSegments = (input: string) => {
  if (!input.includes('<think')) {
    return input
  }

  const removedBlocks = input.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '')

  const normalized = removedBlocks.trim()

  return normalized.length > 0 ? normalized : input
}

const normalizeActionBlocks = (input: string) => {
  if (!input.includes('a??')) {
    return input
  }

  const { startChar, endChar } = AGENT_BUTTONS_BLOCK_OPTIONS

  return input.replace(/a\?\?([\s\S]*?)a\?/g, `${startChar}$1${endChar}`)
}

const MarkdownBlock: LLMOutputComponent = ({ blockMatch }) => (
  <div className="agent-markdown prose prose-sm text-current max-w-none">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{blockMatch.output}</ReactMarkdown>
  </div>
)

const ButtonsBlock = ({ blockMatch, onActionPrompt }: { blockMatch: any; onActionPrompt?: (prompt: string) => void }) => {
  const parsed = useMemo(() => {
    try {
      return parseJson5(blockMatch.output) as ButtonsBlockData
    } catch {
      return null
    }
  }, [blockMatch.output])

  if (!parsed || parsed.type !== 'buttons') {
    return (
      <div className="not-prose rounded-sm border border-warning-200 bg-warning-50/60 px-3 py-2 text-xs text-warning-800">
        Action block could not be rendered.
      </div>
    )
  }

  const buttons = Array.isArray(parsed.buttons) ? parsed.buttons : []
  const title = typeof parsed.title === 'string' ? parsed.title : null
  const isComplete = blockMatch.isComplete === true

  if (!isComplete) {
    return (
      <div className="not-prose rounded-sm border border-default-200 bg-default-50/70 px-3 py-2 text-xs text-default-500">
        Preparing actions...
      </div>
    )
  }

  return (
    <div className="not-prose flex flex-col gap-2">
      {title ? (
        <div className="flex items-center gap-2 text-xs text-default-500">
          <Chip size="sm" variant="flat">
            Actions
          </Chip>
          <span>{title}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {buttons.map((button, index) => {
          const label = typeof button.text === 'string' ? button.text : `Action ${index + 1}`
          const prompt = typeof button.prompt === 'string' ? button.prompt : label

          return (
            <Button
              key={`${label}-${index}`}
              size="sm"
              variant="flat"
              onPress={() => {
                if (onActionPrompt) {
                  onActionPrompt(prompt)
                }
              }}
            >
              {label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

const buttonsBlockConfig = {
  component: ButtonsBlock,
  findCompleteMatch: findCompleteJsonBlock(AGENT_BUTTONS_BLOCK_OPTIONS),
  findPartialMatch: findPartialJsonBlock(AGENT_BUTTONS_BLOCK_OPTIONS),
  lookBack: jsonBlockLookBack(AGENT_BUTTONS_BLOCK_OPTIONS),
}

const fallbackBlock = {
  component: MarkdownBlock,
  lookBack: markdownLookBack(),
}

const useSmoothStream = (text: string) => {
  const [output, setOutput] = useState(text ? '' : text)
  const [isFinished, setIsFinished] = useState(text.length === 0)
  const rafRef = useRef<number | null>(null)
  const positionRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    if (!text) {
      setOutput('')
      setIsFinished(true)
      return
    }

    positionRef.current = 0
    lastRef.current = performance.now()
    setOutput('')
    setIsFinished(false)

    const speedPerSecond = 65

    const tick = (now: number) => {
      const elapsed = now - lastRef.current
      const step = Math.max(1, Math.floor((elapsed / 1000) * speedPerSecond))

      if (step > 0) {
        positionRef.current = Math.min(text.length, positionRef.current + step)
        lastRef.current = now
        setOutput(text.slice(0, positionRef.current))
      }

      if (positionRef.current < text.length) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setIsFinished(true)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [text])

  return { output, isFinished }
}

export function AgentChatOutput({ text, onActionPrompt }: AgentChatOutputProps) {
  const cleanedText = useMemo(() => stripThinkingSegments(text), [text])
  const normalizedText = useMemo(() => normalizeActionBlocks(cleanedText), [cleanedText])
  const { output, isFinished } = useSmoothStream(normalizedText)
  const { blockMatches } = useLLMOutput({
    llmOutput: output,
    blocks: [buttonsBlockConfig],
    fallbackBlock,
    isStreamFinished: isFinished,
    throttle,
  })

  return (
    <div className="space-y-3">
      {blockMatches.map((blockMatch, index) => {
        const Component = blockMatch.block.component as ComponentType<any>

        return <Component key={index} blockMatch={blockMatch} onActionPrompt={onActionPrompt} />
      })}
    </div>
  )
}
