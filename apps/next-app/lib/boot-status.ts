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
    pending: 'Getting things ready…',
    active: 'Finding the best path to connect you…',
    complete: 'Connection paths ready.',
  },

  'loading-identity': {
    pending: 'Preparing your identity…',
    active: 'Unlocking your identity securely…',
    complete: 'Identity ready.',
  },

  'starting-libp2p': {
    pending: 'Setting up your connection…',
    active: 'Bringing you online…',
    complete: 'You’re online.',
  },

  'subscribing-topics': {
    pending: 'Getting the room ready…',
    active: 'Connecting you to live conversations…',
    complete: 'You’re connected to the room.',
  },

  'reserving-relays': {
    pending: 'Stabilizing your connection…',
    active: 'Securing a reliable route…',
    complete: 'Connection secured.',
  },

  'waiting-for-peers': {
    pending: 'Almost there…',
    active: 'Looking for others in the room…',
    complete: 'You’ve joined the room.',
  },
}

const DEFAULT_STATUS = 'Getting Meetred ready…'

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
