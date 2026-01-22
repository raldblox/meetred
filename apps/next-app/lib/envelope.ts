import { CHAT_MESSAGE_APP_ID, CHAT_MESSAGE_WRAPPER } from '@/config/constants'

interface MeetredEnvelope {
  type: typeof CHAT_MESSAGE_WRAPPER
  app: typeof CHAT_MESSAGE_APP_ID
  payload: {
    message: string
  }
}

const ZERO = '\u200b' // zero width space
const ONE = '\u200c' // zero width non-joiner
const GUARD = '\u200d' // zero width joiner to mark start/end

export const encodeZeroWidth = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let bits = ''

  bytes.forEach((b) => {
    bits += b.toString(2).padStart(8, '0')
  })

  return `${GUARD}${bits
    .split('')
    .map((bit) => (bit === '1' ? ONE : ZERO))
    .join('')}${GUARD}`
}

export const decodeZeroWidth = (zw: string): string | null => {
  // strip guard markers
  const start = zw.indexOf(GUARD)
  const end = zw.lastIndexOf(GUARD)

  if (start === -1 || end === -1 || end <= start) return null

  const payload = zw.slice(start + 1, end)

  if (!payload) return null

  const bits: number[] = []

  for (let i = 0; i < payload.length; i++) {
    const ch = payload[i]

    if (ch === ONE) bits.push(1)
    else if (ch === ZERO) bits.push(0)
  }

  if (bits.length === 0 || bits.length % 8 !== 0) return null

  const bytes = new Uint8Array(bits.length / 8)

  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8).reduce((acc, bit, idx) => acc + (bit << (7 - idx)), 0)

    bytes[i / 8] = byte
  }

  try {
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export const wrapMeetredMessage = (message: string): string => {
  const envelope: MeetredEnvelope = {
    type: CHAT_MESSAGE_WRAPPER,
    app: CHAT_MESSAGE_APP_ID,
    payload: {
      message,
    },
  }

  return encodeZeroWidth(JSON.stringify(envelope))
}

export const unwrapMeetredMessage = (raw: string): string | null => {
  try {
    // zero-width encoded payloads
    const decoded = decodeZeroWidth(raw) ?? raw
    const parsed = JSON.parse(decoded) as MeetredEnvelope

    if (parsed?.type === CHAT_MESSAGE_WRAPPER && parsed?.app === CHAT_MESSAGE_APP_ID) {
      const inner = parsed.payload?.message

      return typeof inner === 'string' ? inner : null
    }
  } catch {
    return null
  }

  return null
}
