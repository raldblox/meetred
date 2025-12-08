export type StreamChatPayload = {
  type: 'stream_chat'
  streamId: string
  hostPeerId: string
  body: string
  senderPeerId: string
  createdAt: number
}

export const buildStreamChatPayload = (
  streamId: string,
  hostPeerId: string,
  body: string,
  senderPeerId: string,
): StreamChatPayload => ({
  type: 'stream_chat',
  streamId,
  hostPeerId,
  body,
  senderPeerId,
  createdAt: Date.now(),
})

export const parseStreamChatPayload = (msg: string): StreamChatPayload | null => {
  try {
    const parsed = JSON.parse(msg)

    if (
      parsed?.type === 'stream_chat' &&
      typeof parsed.streamId === 'string' &&
      typeof parsed.hostPeerId === 'string' &&
      typeof parsed.body === 'string'
    ) {
      return {
        type: 'stream_chat',
        streamId: parsed.streamId,
        hostPeerId: parsed.hostPeerId,
        body: parsed.body,
        senderPeerId: typeof parsed.senderPeerId === 'string' ? parsed.senderPeerId : '',
        createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
      }
    }
  } catch {
    // ignore invalid payloads
  }

  return null
}
