export type RoomType = 'ai' | 'stream' | 'call' | 'public'
export type SharePlatform = 'twitter' | 'linkedin' | 'facebook' | 'generic'

type ShareCopy = {
  title: string
  description: string
  cta?: string
}

export const SHARE_COPY: Record<RoomType, Record<SharePlatform, ShareCopy>> = {
  ai: {
    twitter: {
      title: "I'm hosting an AI room on Meetred.",
      description: 'Join and chat with a live AI - no sign-up.',
    },
    linkedin: {
      title: "I'm hosting a live AI room on Meetred.",
      description: "It opens directly in the browser and lets you chat with an AI I'm hosting live.",
    },
    facebook: {
      title: "I'm hosting an AI room on Meetred.",
      description: 'Join the room and try it live - no account needed.',
    },
    generic: {
      title: 'Join my AI room on Meetred.',
      description: 'Chat with a live AI. Opens in your browser - no sign-up.',
    },
  },

  stream: {
    twitter: {
      title: "I'm going live on Meetred.",
      description: 'Join the stream when it starts - no sign-up.',
    },
    linkedin: {
      title: "I'm streaming live on Meetred.",
      description: 'Watch the stream directly in your browser. No account required.',
    },
    facebook: {
      title: 'Live stream on Meetred.',
      description: 'Drop in and watch live - no sign-up needed.',
    },
    generic: {
      title: 'Watch my live stream on Meetred.',
      description: 'Opens in your browser. No sign-up.',
    },
  },

  call: {
    twitter: {
      title: 'Join me for a private call on Meetred.',
      description: 'Live audio and video - no sign-up.',
    },
    linkedin: {
      title: 'Join me for a private call on Meetred.',
      description: 'A simple live call that opens directly in the browser.',
    },
    facebook: {
      title: 'Private call on Meetred.',
      description: 'Join the call live - no account needed.',
    },
    generic: {
      title: 'Join my private call on Meetred.',
      description: 'Live audio and video. Opens in your browser.',
    },
  },

  public: {
    twitter: {
      title: 'Join the public room on Meetred.',
      description: 'Drop in and say hi - no sign-up.',
    },
    linkedin: {
      title: 'Meetred public room.',
      description: 'A shared space where anyone can join and chat live.',
    },
    facebook: {
      title: 'Meetred public room.',
      description: 'Join the conversation - no account required.',
    },
    generic: {
      title: 'Join the public room on Meetred.',
      description: 'Open chat. Opens in your browser.',
    },
  },
}
