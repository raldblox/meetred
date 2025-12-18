import React, { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

import {
  PRIMARY_BOOT_PHASES,
  getBootStatusCopy,
  getDefaultStatusCopy,
  type BootStepSnapshot,
  type BootPhase,
  type BootPhaseState,
} from '@/lib/boot-status'
import { Logo } from './icons'

type BootLogLine = { id: string; text: string; createdAt: number; phase: BootPhase; state: BootPhaseState }

interface Props {
  error?: string
  steps?: BootStepSnapshot[]
  variant?: 'standalone' | 'overlay'
  logLines?: BootLogLine[]
}

const DISPLAY_HEIGHT = 'h-24'

export function Booting({ error, steps = [], variant = 'standalone', logLines = [] }: Props) {
  const containerClass = clsx(
    'grid place-items-center px-6',
    variant === 'overlay' ? 'fixed inset-0 z-50 bg-background/95 backdrop-blur-sm' : 'min-h-screen',
  )

  const focusedStep = useMemo(() => {
    for (const phase of PRIMARY_BOOT_PHASES) {
      const step = steps.find((s) => s.phase === phase)

      if (!step) {
        continue
      }

      if (phase !== PRIMARY_BOOT_PHASES[PRIMARY_BOOT_PHASES.length - 1] && step.state === 'complete') {
        continue
      }

      return step
    }

    return steps.find((s) => s.state === 'active') ?? steps.find((s) => s.state === 'pending') ?? steps[0]
  }, [steps])

  const statusMessage = useMemo(() => {
    if (error) {
      return 'Something tripped our boot sequence...'
    }

    if (!focusedStep) {
      return getDefaultStatusCopy()
    }

    return getBootStatusCopy(focusedStep.phase, focusedStep.state)
  }, [error, focusedStep])

  const latestLog = logLines.length > 0 ? logLines[logLines.length - 1] : null

  const fallbackLine = useMemo(() => {
    if (logLines.length > 0 || !statusMessage) {
      return null
    }

    const fallbackPhase = focusedStep?.phase ?? PRIMARY_BOOT_PHASES[0]
    const fallbackState = focusedStep?.state ?? 'pending'

    return {
      id: `fallback-${fallbackPhase}-${fallbackState}`,
      text: statusMessage,
      createdAt: 0,
      phase: fallbackPhase,
      state: fallbackState,
    }
  }, [focusedStep?.phase, focusedStep?.state, logLines.length, statusMessage])

  const [readyLine, setReadyLine] = useState<BootLogLine | null>(null)

  useEffect(() => {
    if (!latestLog || latestLog.phase !== 'waiting-for-peers' || latestLog.state !== 'complete') {
      setReadyLine(null)

      return
    }

    const timeout = setTimeout(() => {
      setReadyLine({
        id: `boot-ready-${Date.now()}`,
        text: 'Connections ready. Welcome!',
        createdAt: Date.now(),
        phase: latestLog.phase,
        state: latestLog.state,
      })
    }, 1_000)

    return () => clearTimeout(timeout)
  }, [latestLog])

  const pendingOrActiveStep = useMemo(() => {
    return steps.find((step) => step.state === 'pending') ?? steps.find((step) => step.state === 'active') ?? null
  }, [steps])

  const displayLines = useMemo(() => {
    const base = logLines.length > 0 ? logLines : fallbackLine ? [fallbackLine] : []

    const filteredBase: BootLogLine[] = []
    const seenStates = new Set<string>()

    for (const line of base) {
      const key = `${line.phase}-${line.state}`

      if (seenStates.has(key)) {
        continue
      }

      seenStates.add(key)
      filteredBase.push(line)
    }

    let combined = filteredBase

    if (readyLine) {
      const readyKey = `${readyLine.phase}-${readyLine.state}`
      combined = [...filteredBase.filter((line) => `${line.phase}-${line.state}` !== readyKey), readyLine]
    }

    return combined.slice(-3)
  }, [fallbackLine, logLines, readyLine])

  const overlayMotionProps =
    variant === 'overlay'
      ? {
          initial: false,
          exit: { opacity: 0 },
          transition: { duration: 0.2, ease: 'easeOut' },
        }
      : {}

  return (
    <motion.div className={containerClass} {...overlayMotionProps}>
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-6 text-center">
        <Logo size={64} className="text-primary" />

        <div className="w-full max-w-sm px-4">
          <div
            className={clsx(
              'flex w-full flex-col justify-end gap-0 overflow-hidden font-mono text-center text-sm text-default-600',
              DISPLAY_HEIGHT,
            )}
            aria-live="polite"
          >
            <AnimatePresence mode="popLayout">
              {displayLines.map((line, idx, arr) => {
                const age = arr.length - 1 - idx

                return <TerminalLine key={line.id} age={age} text={line.text} />
              })}
            </AnimatePresence>
          </div>
        </div>

        {error ? <p className="max-w-lg break-all text-xs text-danger">{error}</p> : null}
      </div>
    </motion.div>
  )
}

function TerminalLine({ text, age }: { text: string; age: number }) {
  const opacities = [1, 0.65, 0.25]
  const offsets = [0, -8, -16]
  const clampedAge = Math.min(age, 2)
  const targetOpacity = opacities[clampedAge]
  const targetOffset = offsets[clampedAge]

  return (
    <motion.p
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: targetOpacity, y: targetOffset }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex h-4 items-center justify-center text-[11px] leading-none"
    >
      {text}
    </motion.p>
  )
}
