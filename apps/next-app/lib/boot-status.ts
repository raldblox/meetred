import { BOOT_COPY, DEFAULT_STATUS, type BootPhase } from '@/config/copy'

export type { BootPhase }
export type BootPhaseState = 'pending' | 'active' | 'complete' | 'error'

export interface BootStatusUpdate {
  phase: BootPhase
  state: BootPhaseState
  message?: string
}

export interface BootStepDefinition {
  phase: BootPhase
  label: string
}

export interface BootStepSnapshot extends BootStatusUpdate {
  label: string
}

export const DEFAULT_BOOT_STEPS: BootStepDefinition[] = [
  { phase: 'resolving-relays', label: 'Resolving bootstrap relays' },
  { phase: 'loading-identity', label: 'Loading identity' },
  { phase: 'starting-libp2p', label: 'Starting libp2p node' },
  { phase: 'subscribing-topics', label: 'Joining pubsub topics' },
  { phase: 'reserving-relays', label: 'Creating relay reservations' },
  { phase: 'waiting-for-peers', label: 'Discovering peers' },
]

export const PRIMARY_BOOT_PHASES: BootPhase[] = ['starting-libp2p', 'waiting-for-peers']

export function getBootStatusCopy(phase: BootPhase, state: BootPhaseState): string {
  const phaseCopy = BOOT_COPY[phase]

  if (!phaseCopy) {
    return DEFAULT_STATUS
  }

  if (state === 'complete') {
    return phaseCopy.complete
  }

  if (state === 'active') {
    return phaseCopy.active
  }

  return phaseCopy.pending
}

export function getDefaultStatusCopy() {
  return DEFAULT_STATUS
}
