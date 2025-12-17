export type BootPhase =
  | 'resolving-relays'
  | 'loading-identity'
  | 'starting-libp2p'
  | 'subscribing-topics'
  | 'reserving-relays'
  | 'waiting-for-peers'

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

const STATUS_COPY: Record<BootPhase, { active: string; pending: string; complete: string }> = {
  'resolving-relays': {
    pending: 'Checking the relay weather...',
    active: 'Consulting the relay oracles...',
    complete: 'Relays bribed successfully.',
  },
  'loading-identity': {
    pending: 'Dusting off your secret identity...',
    active: 'Polishing your alter ego badge...',
    complete: 'Identity cape secured.',
  },
  'starting-libp2p': {
    pending: 'Fueling up the radio antennas...',
    active: 'Spinning up the libp2p engines...',
    complete: 'Engines humming nicely.',
  },
  'subscribing-topics': {
    pending: 'Sneaking into gossip circles...',
    active: 'Eavesdropping on the gossip mesh...',
    complete: 'Now fluent in small talk.',
  },
  'reserving-relays': {
    pending: 'Scouting for VIP relay seats...',
    active: 'Slipping relays a friendly tip...',
    complete: 'Reserved a comfy relay couch.',
  },
  'waiting-for-peers': {
    pending: 'Setting the snack table for guests...',
    active: 'Waiting for friends to pop in...',
    complete: 'Friend spotted! Scooting over.',
  },
}

const DEFAULT_STATUS = 'Preparing the chat floor...'

export function getBootStatusCopy(phase: BootPhase, state: BootPhaseState): string {
  const phaseCopy = STATUS_COPY[phase]

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
