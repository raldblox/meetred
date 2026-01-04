// Meetred UI copy - simple, instructive, trustworthy. No protocol jargon by default.

export type InviteType = 'stream' | 'call' | 'ai'
export type InviteStatus = 'live' | 'ready' | 'waiting' | 'ended'

/**
 * Public Room (landing page) copy
 */
export const PUBLIC_ROOM_COPY = {
  headerSubtitle: 'Global room for chat, streams, calls, and AI rooms.',

  pinnedGuide: {
    author: 'Meetred guide',
    title: 'Welcome to Meetred',
    body: 'This is the public room. Chat with everyone here, or start a stream, a private call, or an AI room. Everything runs in your browser.',
    chips: ['Say hi', 'Go live', 'Start a call', 'Start an AI room', 'Invite a friend'],
    sayHiTemplate: "Hey everyone, I'm new here. What's happening?",
    footer: 'Tip: Back up your identity in Identity to keep your DMs and rooms.',
    dismiss: 'Got it',
  },

  emptyState: {
    title: "You're in the public room",
    body: 'When the room is quiet, be the first to start something. Streams, calls, and AI rooms show up here as cards.',
    primaryCta: 'Say hi',
    secondaryCta: 'Go live',
  },

  composer: {
    placeholder: 'Say hi... or share a room link',
    helper: 'Use Go live, Start a call, or Start an AI room to post a card here.',
  },

  safetyNote: 'This room is public. Keep it respectful and avoid sharing sensitive info.',
} as const

/**
 * Invite card copy - one component, three types.
 * Render by type + status; keep the visual layout identical across all cards.
 */
export const INVITE_CARD_COPY: Record<
  InviteType,
  Record<
    InviteStatus,
    {
      label: string
      title: (hostName: string) => string
      body: string
      meta?: string
      cta: string
      secondaryCta?: string
    }
  >
> = {
  stream: {
    live: {
      label: 'Live stream',
      title: (host) => `${host} is live`,
      body: 'Watch the stream and chat with the audience in real time.',
      meta: 'Only the host can broadcast.',
      cta: 'Watch',
      secondaryCta: 'Details',
    },
    ready: {
      label: 'Stream room',
      title: (host) => `Stream by ${host}`,
      body: 'Open the stream room. The host will start when ready.',
      meta: 'Only the host can broadcast.',
      cta: 'Open',
      secondaryCta: 'Details',
    },
    waiting: {
      label: 'Stream room',
      title: (host) => `Stream by ${host}`,
      body: 'Waiting for the host to start streaming.',
      meta: 'You can stay in the room and chat.',
      cta: 'Open',
      secondaryCta: 'Details',
    },
    ended: {
      label: 'Stream ended',
      title: (host) => `Stream by ${host}`,
      body: 'This stream has ended.',
      cta: 'View',
      secondaryCta: 'Details',
    },
  },

  call: {
    ready: {
      label: 'Private call',
      title: (host) => `Call ${host}`,
      body: 'Join a private room for two-way audio and video.',
      meta: 'Camera and mic are optional.',
      cta: 'Join',
      secondaryCta: 'Details',
    },
    waiting: {
      label: 'Private call',
      title: (host) => `Call ${host}`,
      body: 'Waiting for the host to start the call.',
      meta: 'You can join now and wait.',
      cta: 'Join',
      secondaryCta: 'Details',
    },
    live: {
      label: 'Private call',
      title: (host) => `Call with ${host}`,
      body: 'The call is active. Join now.',
      meta: 'Camera and mic are optional.',
      cta: 'Join',
      secondaryCta: 'Details',
    },
    ended: {
      label: 'Call ended',
      title: (host) => `Call with ${host}`,
      body: 'This call has ended.',
      cta: 'View',
      secondaryCta: 'Details',
    },
  },

  ai: {
    ready: {
      label: 'AI room',
      title: (host) => `AI room by ${host}`,
      body: 'Open the room to chat with the AI once the host brings it online.',
      meta: 'The host chooses the model.',
      cta: 'Open',
      secondaryCta: 'Details',
    },
    waiting: {
      label: 'AI room',
      title: (host) => `AI room by ${host}`,
      body: "The host is connecting the model. Chat will start when it's ready.",
      meta: 'The host chooses the model.',
      cta: 'Open',
      secondaryCta: 'Details',
    },
    live: {
      label: 'AI room',
      title: (host) => `Chat with ${host}'s AI`,
      body: 'Ask questions and get responses in real time.',
      meta: 'The host provides the model.',
      cta: 'Open',
      secondaryCta: 'Details',
    },
    ended: {
      label: 'AI room closed',
      title: (host) => `AI room by ${host}`,
      body: 'This AI room is offline.',
      cta: 'View',
      secondaryCta: 'Details',
    },
  },
} as const

/**
 * AI Room (agent chat) copy - user-friendly labels, explicit trust notes.
 */
export const AI_ROOM_COPY = {
  header: {
    roomLinkLabel: 'Room link',
    roomLinkHelper: 'Share this link to invite others into this AI room.',
    copy: 'Copy',
    copied: 'Copied',
    advancedToggle: 'Advanced',
    advancedPeerIdLabel: 'Advanced ID',
  },

  chatPanel: {
    titleWaiting: 'Waiting for the AI to come online',
    subtitleWaiting: "The host is connecting a model. Once it's ready, you can chat here in real time.",
    titleReady: 'Agent chat',
    subtitleReady: 'Ask questions and get responses in real time.',
    empty: 'No messages yet. Ask your first question when the AI is ready.',
    inputPlaceholderDisabled: 'Send a message to the model...',
    inputPlaceholderReady: 'Send a message to the model...',
    send: 'Send',
  },

  setupPanel: {
    title: 'Model setup',
    tabs: { local: 'Local', openai: 'OpenAI' },

    local: {
      urlLabel: 'Local model URL',
      urlPlaceholder: 'http://127.0.0.1:1234',
      urlHelper: 'Start your local model server, then paste its URL here.',
      button: 'Connect model',
      buttonConnecting: 'Connecting...',
      statusWaiting: 'Waiting for a model...',
      statusConnected: 'Model connected.',
      detectedTitle: 'Available models',
      detectedEmpty: 'No models detected yet. Start your local model, then click refresh.',
      refresh: 'Refresh',
    },

    openai: {
      keyLabel: 'OpenAI API key',
      keyPlaceholder: 'sk-...',
      keyHelper: 'Your key stays on this device. Meetred does not store it.',
      button: 'Connect model',
      buttonConnecting: 'Connecting...',
    },
  },

  logPanel: {
    title: 'Session log',
    empty: 'No activity yet.',
  },
} as const

/**
 * Stream Room copy - aligns with current behavior (no public-room echoing).
 */
export const STREAM_ROOM_COPY = {
  header: {
    titlePrefix: 'Stream',
  },

  centerEmptyHost: {
    title: "You're ready to go live",
    body: 'When you start streaming, your stream will appear in the public room as a preview card. Viewers can watch and chat with you here.',
  },

  controls: {
    title: 'Stream controls',
    hostHint: 'You are the host. Start streaming when you are ready.',
    start: 'Start stream',
    starting: 'Starting...',
    shareScreen: 'Share screen',
    stop: 'Stop stream',
  },

  chat: {
    title: 'Stream chat',
    audienceLabel: 'Connected audience',
    empty: 'No chat yet. Say hello when viewers arrive.',
    placeholder: 'Send a message...',
    send: 'Send',
  },

  activity: {
    title: 'Activity log',
    empty: 'No activity yet.',
  },
} as const

/**
 * Meeting / Call room copy (optional, but useful for consistent UI)
 */
export const CALL_ROOM_COPY = {
  header: {
    titlePrefix: 'Call',
  },
  preJoin: {
    title: 'Private call',
    body: 'Join a private room for two-way audio and video. Camera and mic are optional.',
    join: 'Join call',
  },
  inCall: {
    title: 'Private call',
    leave: 'Leave',
    mute: 'Mute',
    unmute: 'Unmute',
    cameraOn: 'Camera on',
    cameraOff: 'Camera off',
  },
} as const

/**
 * General UI labels and toasts
 */
export const UI_COPY = {
  nav: {
    chat: 'Chat',
    stream: 'Stream',
    call: 'Call',
    ai: 'AI',
    invite: 'Invite',
    identity: 'Identity',
  },

  composer: {
    label: 'Message',
    helper: 'Public room · Visible to everyone',
    placeholder: 'Say hi… or share a room link',
    tip: 'Tip: Use Stream, Call, or AI to post a room card here.',
  },

  actions: {
    attach: 'Attach',
    aiRoom: 'AI room',
    stream: 'Stream',
    call: 'Call',
    send: 'Send',
  },

  tooltips: {
    nav: {
      chat: 'Go to the public room',
      stream: 'Open your stream room',
      call: 'Open your call room',
      ai: 'Open your AI room',
      invite: 'Share a link to Meetred',
      identity: 'Back up or switch identity',
    },
    composer: {
      attach: 'Share a file in the public room',
      aiRoom: 'Post your AI room to the public room',
      stream: 'Post your stream room to the public room',
      call: 'Post your call room to the public room',
      send: 'Send message',
    },
  },
} as const

/**
 * Boot / loading status copy - human, calm, non-technical.
 */
export type BootPhase =
  | 'resolving-relays'
  | 'loading-identity'
  | 'starting-libp2p'
  | 'subscribing-topics'
  | 'reserving-relays'
  | 'waiting-for-peers'

export const BOOT_COPY: Record<BootPhase, { active: string; pending: string; complete: string }> = {
  'resolving-relays': {
    pending: 'Getting things ready...',
    active: 'Finding the best path to connect you...',
    complete: 'Connection paths ready.',
  },
  'loading-identity': {
    pending: 'Preparing your identity...',
    active: 'Unlocking your identity securely...',
    complete: 'Identity ready.',
  },
  'starting-libp2p': {
    pending: 'Setting up your connection...',
    active: 'Bringing you online...',
    complete: "You're online.",
  },
  'subscribing-topics': {
    pending: 'Getting the room ready...',
    active: 'Connecting you to live conversations...',
    complete: "You're connected to the room.",
  },
  'reserving-relays': {
    pending: 'Stabilizing your connection...',
    active: 'Securing a reliable route...',
    complete: 'Connection secured.',
  },
  'waiting-for-peers': {
    pending: 'Almost there...',
    active: 'Looking for others in the room...',
    complete: "You've joined the room.",
  },
} as const

export const DEFAULT_STATUS = 'Getting Meetred ready...'
