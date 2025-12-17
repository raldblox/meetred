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
