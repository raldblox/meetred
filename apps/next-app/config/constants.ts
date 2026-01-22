export const CHAT_TOPIC = 'meetred'
export const CHAT_FILE_TOPIC = 'meetred-file'
export const PUBSUB_PEER_DISCOVERY = 'meetred-browser-peer-discovery'
export const FILE_EXCHANGE_PROTOCOL = '/meetred-file/1'
export const DIRECT_MESSAGE_PROTOCOL = '/meetred/dm/1.0.0'
export const STREAM_SIGNAL_WRAPPER = 'stream-signal'
export const STREAM_SIGNAL_APP_ID = 'meetred'
export const STREAM_SIGNAL_TOPIC = CHAT_TOPIC
export const STREAM_CHAT_TOPIC = CHAT_TOPIC
export const AGENT_SIGNAL_WRAPPER = 'agent-signal'
export const AGENT_SIGNAL_APP_ID = 'meetred-agent'
export const AGENT_SIGNAL_TOPIC = CHAT_TOPIC
export const AGENT_CHAT_TOPIC = CHAT_TOPIC
export const CALL_SIGNAL_WRAPPER = 'call-signal'
export const CALL_SIGNAL_APP_ID = 'meetred-call'
export const CALL_SIGNAL_TOPIC = CHAT_TOPIC
export const CHAT_MESSAGE_WRAPPER = 'meetred-chat'
export const CHAT_MESSAGE_APP_ID = 'meetred'
export const LM_STUDIO_DEFAULT_BASE_URL = 'http://127.0.0.1:4312'
export const LM_STUDIO_DEFAULT_TARGET_URL = 'http://127.0.0.1:1234'

export const CIRCUIT_RELAY_CODE = 290

export const MIME_TEXT_PLAIN = 'text/plain'

// 👇 App specific dedicated bootstrap PeerIDs
// Their multiaddrs are ephemeral so peer routing is used to resolve multiaddr
export const WEBTRANSPORT_BOOTSTRAP_PEER_ID = '12D3KooWFhXabKDwALpzqMbto94sB7rvmZ6M28hs9Y9xSopDKwQr'

export const BOOTSTRAP_PEER_IDS = [WEBTRANSPORT_BOOTSTRAP_PEER_ID]
