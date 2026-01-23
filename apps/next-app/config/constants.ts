import * as shared from './constants.shared.js'

export const CHAT_TOPIC = shared.CHAT_TOPIC
export const CHAT_FILE_TOPIC = shared.CHAT_FILE_TOPIC
export const PUBSUB_PEER_DISCOVERY = shared.PUBSUB_PEER_DISCOVERY
export const FILE_EXCHANGE_PROTOCOL = shared.FILE_EXCHANGE_PROTOCOL
export const DIRECT_MESSAGE_PROTOCOL = shared.DIRECT_MESSAGE_PROTOCOL
export const STREAM_SIGNAL_WRAPPER = shared.STREAM_SIGNAL_WRAPPER
export const STREAM_SIGNAL_APP_ID = shared.STREAM_SIGNAL_APP_ID
export const STREAM_SIGNAL_TOPIC = shared.STREAM_SIGNAL_TOPIC
export const STREAM_CHAT_TOPIC = shared.STREAM_CHAT_TOPIC
export const AGENT_SIGNAL_WRAPPER = shared.AGENT_SIGNAL_WRAPPER
export const AGENT_SIGNAL_APP_ID = shared.AGENT_SIGNAL_APP_ID
export const AGENT_SIGNAL_TOPIC = shared.AGENT_SIGNAL_TOPIC
export const AGENT_CHAT_TOPIC = shared.AGENT_CHAT_TOPIC
export const CALL_SIGNAL_WRAPPER = shared.CALL_SIGNAL_WRAPPER
export const CALL_SIGNAL_APP_ID = shared.CALL_SIGNAL_APP_ID
export const CALL_SIGNAL_TOPIC = shared.CALL_SIGNAL_TOPIC
export const CHAT_MESSAGE_WRAPPER = shared.CHAT_MESSAGE_WRAPPER
export const CHAT_MESSAGE_APP_ID = shared.CHAT_MESSAGE_APP_ID
export const LM_STUDIO_DEFAULT_BASE_URL = shared.LM_STUDIO_DEFAULT_BASE_URL
export const LM_STUDIO_DEFAULT_TARGET_URL = shared.LM_STUDIO_DEFAULT_TARGET_URL
export const CIRCUIT_RELAY_CODE = shared.CIRCUIT_RELAY_CODE
export const MIME_TEXT_PLAIN = shared.MIME_TEXT_PLAIN
export const WEBTRANSPORT_BOOTSTRAP_PEER_ID = shared.WEBTRANSPORT_BOOTSTRAP_PEER_ID
export const BOOTSTRAP_PEER_IDS = shared.BOOTSTRAP_PEER_IDS
export const ANALYTICS_WRAPPER = shared.ANALYTICS_WRAPPER
export const ANALYTICS_APP_ID = shared.ANALYTICS_APP_ID

type SpecialPeerKind = 'relay' | 'archival' | 'metrics' | 'analytics' | 'agent'
export const SPECIAL_PEERS: Record<string, SpecialPeerKind> = (() => {
  const raw = process.env.NEXT_PUBLIC_SPECIAL_PEERS ?? ''
  const map: Record<string, SpecialPeerKind> = {}

  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const [peerId, kind] = entry.split('=').map((part) => part.trim())
      if (!peerId || !kind) {
        return
      }
      if (kind === 'relay' || kind === 'archival' || kind === 'metrics' || kind === 'analytics' || kind === 'agent') {
        map[peerId] = kind
      }
    })

  return map
})()
