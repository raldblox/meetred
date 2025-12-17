import React, { useMemo } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'

import { PRIMARY_BOOT_PHASES, getBootStatusCopy, getDefaultStatusCopy, type BootStepSnapshot } from '@/lib/boot-status'
import { Logo } from './icons'

type BootLogLine = { id: string; text: string }

interface Props {
  error?: string
  steps?: BootStepSnapshot[]
  variant?: 'standalone' | 'overlay'
  logLines?: BootLogLine[]
}

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

      // If this phase finished, keep moving unless it's the final phase we care about.
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

  const displayLines = useMemo(() => {
    if (logLines.length > 0) {
      return logLines.slice(-3)
    }

    return statusMessage ? [{ id: `status-${statusMessage}`, text: statusMessage }] : []
  }, [logLines, statusMessage])

  return (
    <div className={containerClass}>
      <div className="flex w-full max-w-md flex-col items-center justify-center gap-6 text-center">
        <Logo size={40} className="text-primary" />

        <div className="w-full max-w-sm px-4">
          <div
            className="flex h-[1rem] w-full flex-col justify-end gap-0 overflow-hidden font-mono text-center text-sm text-default-600"
            aria-live="polite"
          >
            <AnimatePresence mode="popLayout">
              {displayLines.map((line, idx, arr) => {
                const age = arr.length - 1 - idx

                return <TerminalLine age={age} key={line.id} text={line.text} />
              })}
            </AnimatePresence>
          </div>
        </div>

        {error ? <p className="max-w-lg break-all leading-0 text-xs text-danger">{error}</p> : null}
      </div>
    </div>
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: targetOpacity, y: targetOffset }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex h-[1.25rem] items-center justify-center text-xs"
    >
      {text}
    </motion.p>
  )
}
