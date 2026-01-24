const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')

const loadLibp2pModules = async () => {
  const [
    libp2p,
    identifyModule,
    gossipsubModule,
    noiseModule,
    yamuxModule,
    webSocketsModule,
    relayModule,
    cryptoKeysModule,
    uint8FromModule,
    multiaddrModule,
    pubsubPeerDiscoveryModule,
  ] = await Promise.all([
    import('libp2p'),
    import('@libp2p/identify'),
    import('@chainsafe/libp2p-gossipsub'),
    import('@chainsafe/libp2p-noise'),
    import('@chainsafe/libp2p-yamux'),
    import('@libp2p/websockets'),
    import('@libp2p/circuit-relay-v2'),
    import('@libp2p/crypto/keys'),
    import('uint8arrays/from-string'),
    import('@multiformats/multiaddr'),
    import('@libp2p/pubsub-peer-discovery'),
  ])

  return {
    createLibp2p: libp2p.createLibp2p,
    identify: identifyModule.identify,
    gossipsub: gossipsubModule.gossipsub,
    noise: noiseModule.noise,
    yamux: yamuxModule.yamux,
    webSockets: webSocketsModule.webSockets,
    circuitRelayServer: relayModule.circuitRelayServer,
    generateKeyPair: cryptoKeysModule.generateKeyPair,
    privateKeyFromProtobuf: cryptoKeysModule.privateKeyFromProtobuf,
    privateKeyToProtobuf: cryptoKeysModule.privateKeyToProtobuf,
    uint8ArrayFromString: uint8FromModule.fromString,
    multiaddr: multiaddrModule.multiaddr,
    pubsubPeerDiscovery: pubsubPeerDiscoveryModule.pubsubPeerDiscovery,
  }
}

const loadEnvFile = () => {
  const candidates = [path.join(process.cwd(), '.env'), path.join(__dirname, '..', '.env')]

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        continue
      }

      const idx = trimmed.indexOf('=')
      if (idx === -1) {
        continue
      }

      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()

      if (!key || process.env[key] !== undefined) {
        continue
      }

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }

    break
  }
}

loadEnvFile()

const getHost = (value) => (value ?? process.env.LIBP2P_METRICS_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
const getPort = (value) => Number.parseInt(value ?? process.env.LIBP2P_METRICS_PORT ?? '15014', 10)
const getKeyPath = (value) => value ?? process.env.LIBP2P_METRICS_KEY_PATH ?? path.join(__dirname, 'metrics.key')
const getMetricsHost = (value, fallbackHost) =>
  (value ?? process.env.LIBP2P_METRICS_HTTP_HOST ?? fallbackHost).trim() || fallbackHost
const getMetricsPort = (value) =>
  Number.parseInt(value ?? process.env.LIBP2P_METRICS_HTTP_PORT ?? process.env.LIBP2P_METRICS_METRICS_PORT ?? '15015', 10)
const {
  CHAT_TOPIC: DEFAULT_CHAT_TOPIC,
  CHAT_FILE_TOPIC: DEFAULT_FILE_TOPIC,
  PUBSUB_PEER_DISCOVERY: DEFAULT_DISCOVERY_TOPIC,
  STREAM_SIGNAL_WRAPPER: DEFAULT_STREAM_SIGNAL_WRAPPER,
  STREAM_SIGNAL_APP_ID: DEFAULT_STREAM_SIGNAL_APP_ID,
  CALL_SIGNAL_WRAPPER: DEFAULT_CALL_SIGNAL_WRAPPER,
  CALL_SIGNAL_APP_ID: DEFAULT_CALL_SIGNAL_APP_ID,
  AGENT_SIGNAL_WRAPPER: DEFAULT_AGENT_SIGNAL_WRAPPER,
  AGENT_SIGNAL_APP_ID: DEFAULT_AGENT_SIGNAL_APP_ID,
  ANALYTICS_WRAPPER: DEFAULT_ANALYTICS_WRAPPER,
  ANALYTICS_APP_ID: DEFAULT_ANALYTICS_APP_ID,
} = require('./constants')

const STREAM_APP_ID = (process.env.LIBP2P_STREAM_APP_ID ?? DEFAULT_STREAM_SIGNAL_APP_ID).trim() || DEFAULT_STREAM_SIGNAL_APP_ID
const AGENT_APP_ID = (process.env.LIBP2P_AGENT_APP_ID ?? DEFAULT_AGENT_SIGNAL_APP_ID).trim() || DEFAULT_AGENT_SIGNAL_APP_ID
const STREAM_SIGNAL_WRAPPER =
  (process.env.LIBP2P_STREAM_SIGNAL_WRAPPER ?? DEFAULT_STREAM_SIGNAL_WRAPPER).trim() || DEFAULT_STREAM_SIGNAL_WRAPPER
const CALL_SIGNAL_WRAPPER =
  (process.env.LIBP2P_CALL_SIGNAL_WRAPPER ?? DEFAULT_CALL_SIGNAL_WRAPPER).trim() || DEFAULT_CALL_SIGNAL_WRAPPER
const AGENT_SIGNAL_WRAPPER =
  (process.env.LIBP2P_AGENT_SIGNAL_WRAPPER ?? DEFAULT_AGENT_SIGNAL_WRAPPER).trim() || DEFAULT_AGENT_SIGNAL_WRAPPER
const STREAM_SIGNAL_APP_ID =
  (process.env.LIBP2P_STREAM_SIGNAL_APP_ID ?? DEFAULT_STREAM_SIGNAL_APP_ID).trim() || DEFAULT_STREAM_SIGNAL_APP_ID
const CALL_SIGNAL_APP_ID =
  (process.env.LIBP2P_CALL_SIGNAL_APP_ID ?? DEFAULT_CALL_SIGNAL_APP_ID).trim() || DEFAULT_CALL_SIGNAL_APP_ID
const AGENT_SIGNAL_APP_ID =
  (process.env.LIBP2P_AGENT_SIGNAL_APP_ID ?? DEFAULT_AGENT_SIGNAL_APP_ID).trim() || DEFAULT_AGENT_SIGNAL_APP_ID
const METRICS_BOOTSTRAP_ADDRS = (process.env.LIBP2P_METRICS_BOOTSTRAP_ADDRS ?? '').trim()
const DEFAULT_BOOTSTRAP_ADDRS = (process.env.NEXT_PUBLIC_LOCAL_RELAY_ADDRS ?? '').trim()
const ANALYTICS_WRAPPER = (process.env.LIBP2P_ANALYTICS_WRAPPER ?? DEFAULT_ANALYTICS_WRAPPER).trim() || DEFAULT_ANALYTICS_WRAPPER
const ANALYTICS_APP_ID = (process.env.LIBP2P_ANALYTICS_APP_ID ?? DEFAULT_ANALYTICS_APP_ID).trim() || DEFAULT_ANALYTICS_APP_ID

const DISCOVERY_TOPIC =
  (process.env.LIBP2P_DISCOVERY_TOPIC ?? DEFAULT_DISCOVERY_TOPIC).trim() || DEFAULT_DISCOVERY_TOPIC
const CHAT_TOPIC = (process.env.LIBP2P_CHAT_TOPIC ?? DEFAULT_CHAT_TOPIC).trim() || DEFAULT_CHAT_TOPIC
const FILE_TOPIC = (process.env.LIBP2P_FILE_TOPIC ?? DEFAULT_FILE_TOPIC).trim() || DEFAULT_FILE_TOPIC

const listenWithRetry = async (server, host, port, maxAttempts = 5) => {
  let lastError

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const nextPort = port + attempt

    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening)
          reject(error)
        }
        const onListening = () => {
          server.off('error', onError)
          resolve()
        }

        server.once('error', onError)
        server.listen(nextPort, host, onListening)
      })

      return nextPort
    } catch (error) {
      lastError = error
      if (error?.code !== 'EADDRINUSE') {
        throw error
      }
    }
  }

  throw lastError
}

const parseEncodedKey = (value, uint8ArrayFromString) => {
  const cleaned = (value ?? '').trim()
  if (!cleaned) {
    return null
  }

  const hexPattern = /^(0x)?[0-9a-fA-F]+$/

  if (hexPattern.test(cleaned)) {
    const normalized = cleaned.startsWith('0x') ? cleaned.slice(2) : cleaned
    return uint8ArrayFromString(normalized, 'hex')
  }

  return uint8ArrayFromString(cleaned, 'base64pad')
}

const normalizeBootstrapAddr = (addr) => {
  if (!addr.includes('/p2p-circuit')) {
    return addr
  }

  if (addr.includes('/p2p-circuit/p2p/')) {
    return addr
  }

  return addr.replace(/\/p2p-circuit\/?$/, '')
}

const parseBootstrapAddrs = () =>
  `${METRICS_BOOTSTRAP_ADDRS}${METRICS_BOOTSTRAP_ADDRS && DEFAULT_BOOTSTRAP_ADDRS ? ',' : ''}${DEFAULT_BOOTSTRAP_ADDRS}`
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeBootstrapAddr)

const decodeZeroWidth = (value) => {
  const ZERO = '\u200b'
  const ONE = '\u200c'
  const GUARD = '\u200d'

  const start = value.indexOf(GUARD)
  const end = value.lastIndexOf(GUARD)
  if (start === -1 || end === -1 || end <= start) {
    return null
  }

  const payload = value.slice(start + 1, end)
  if (!payload) {
    return null
  }

  const bits = []

  for (let i = 0; i < payload.length; i += 1) {
    const ch = payload[i]
    if (ch === ONE) bits.push(1)
    else if (ch === ZERO) bits.push(0)
  }

  if (bits.length === 0 || bits.length % 8 !== 0) {
    return null
  }

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

const unwrapMeetredMessage = (raw) => {
  try {
    const decoded = decodeZeroWidth(raw) ?? raw
    const parsed = JSON.parse(decoded)

    if (parsed?.payload?.message && typeof parsed.payload.message === 'string') {
      return parsed.payload.message
    }
  } catch {
    // ignore invalid payloads
  }

  return null
}

const parseInvite = (message) => {
  try {
    const parsed = JSON.parse(message)

    if (parsed?.type === 'meeting_invite' && typeof parsed.roomId === 'string') {
      return { roomType: 'call', roomId: parsed.roomId }
    }

    if (parsed?.type === 'stream_invite' && typeof parsed.hostPeerId === 'string') {
      return { roomType: 'stream', roomId: parsed.hostPeerId }
    }

    if (parsed?.type === 'agent_invite' && typeof parsed.agentPeerId === 'string') {
      return { roomType: 'ai', roomId: parsed.agentPeerId }
    }
  } catch {
    // ignore non-invite payloads
  }

  return null
}

const parseStreamChat = (message) => {
  try {
    const parsed = JSON.parse(message)

    if (parsed?.type === 'stream_chat' && parsed?.app === STREAM_APP_ID && typeof parsed.streamId === 'string') {
      return { roomType: 'stream', roomId: parsed.streamId }
    }
  } catch {
    // ignore malformed payloads
  }

  return null
}

const parseAnalyticsEnvelope = (raw) => {
  try {
    const decoded = decodeZeroWidth(raw) ?? raw
    const parsed = JSON.parse(decoded)

    if (parsed?.type === ANALYTICS_WRAPPER && parsed?.app === ANALYTICS_APP_ID && parsed?.payload) {
      return parsed.payload
    }
  } catch {
    // ignore malformed analytics payloads
  }

  return null
}

const parseSignalEnvelope = (raw) => {
  try {
    const decoded = decodeZeroWidth(raw) ?? raw
    const parsed = JSON.parse(decoded)

    if (parsed?.type === STREAM_SIGNAL_WRAPPER && parsed?.app === STREAM_SIGNAL_APP_ID) {
      return { kind: 'stream', payload: parsed.payload }
    }

    if (parsed?.type === CALL_SIGNAL_WRAPPER && parsed?.app === CALL_SIGNAL_APP_ID) {
      return { kind: 'call', payload: parsed.payload }
    }

    if (parsed?.type === AGENT_SIGNAL_WRAPPER && parsed?.app === AGENT_SIGNAL_APP_ID) {
      return { kind: 'agent', payload: parsed.payload }
    }
  } catch {
    // ignore malformed signal envelopes
  }

  return null
}

const parseAgentChat = (message) => {
  try {
    const parsed = JSON.parse(message)

    if (parsed?.type === 'agent_chat' && parsed?.app === AGENT_APP_ID && typeof parsed.agentPeerId === 'string') {
      return { roomType: 'ai', roomId: parsed.agentPeerId }
    }
  } catch {
    // ignore malformed payloads
  }

  return null
}

const loadOrCreateKey = async (
  { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf, uint8ArrayFromString },
  keyPath,
) => {
  const envKey = (process.env.LIBP2P_METRICS_KEY ?? '').trim()

  if (envKey) {
    const bytes = parseEncodedKey(envKey, uint8ArrayFromString)
    if (bytes) {
      return privateKeyFromProtobuf(bytes)
    }
  }

  if (fs.existsSync(keyPath)) {
    const encoded = fs.readFileSync(keyPath, 'utf8').trim()

    if (encoded) {
      const bytes = parseEncodedKey(encoded, uint8ArrayFromString)
      if (bytes) {
        return privateKeyFromProtobuf(bytes)
      }
    }
  }

  const key = await generateKeyPair('Ed25519')
  const bytes = privateKeyToProtobuf(key)
  const encoded = Buffer.from(bytes).toString('base64')

  fs.mkdirSync(path.dirname(keyPath), { recursive: true })
  fs.writeFileSync(keyPath, encoded, 'utf8')

  return key
}

const shouldSkipMetrics = () => {
  const flag = (process.env.START_LIBP2P_METRICS ?? '').toLowerCase().trim()

  if (flag === '0' || flag === 'false' || flag === 'off') {
    return true
  }

  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    return true
  }

  return false
}

const createMetricsServer = (state) =>
  http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    if (req.method !== 'GET') {
      res.writeHead(405)
      res.end()
      return
    }

    if (req.url !== '/metrics') {
      res.writeHead(404)
      res.end()
      return
    }

    const payload = {
      startedAt: state.startedAt,
      peerId: state.peerId,
      topics: state.topics,
      onlinePeers: {
        count: state.onlinePeers.size,
        byTopic: state.onlinePeersByTopic,
      },
      counters: state.counters,
      roomTypes: state.roomTypes,
      invites: state.invites,
      analytics: state.analytics,
      uptimeMs: Date.now() - state.startedAt,
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end(JSON.stringify(payload))
  })

const createMetricsNode = async (options = {}) => {
  const modules = await loadLibp2pModules()
  const host = getHost(options.host)
  const port = getPort(options.port)
  const keyPath = getKeyPath(options.keyPath)
  const metricsHost = getMetricsHost(options.metricsHost, host)
  const metricsPort = getMetricsPort(options.metricsPort)
  const privateKey = await loadOrCreateKey(modules, keyPath)

  const createNodeForPort = async (listenPort) =>
    modules.createLibp2p({
      privateKey,
      addresses: {
        listen: [`/ip4/${host}/tcp/${listenPort}/ws`],
      },
      transports: [modules.webSockets()],
      connectionEncrypters: [modules.noise()],
      streamMuxers: [modules.yamux()],
      services: {
        identify: modules.identify(),
        pubsub: modules.gossipsub({
          allowPublishToZeroTopicPeers: true,
          ignoreDuplicatePublishError: true,
        }),
        circuitRelay: modules.circuitRelayServer(),
      },
      peerDiscovery: [
        modules.pubsubPeerDiscovery({
          interval: 3_000,
          topics: [DISCOVERY_TOPIC],
          listenOnly: false,
        }),
      ],
    })

  let node
  let listenPort = port
  const maxAttempts = 5

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      node = await createNodeForPort(listenPort)
      break
    } catch (error) {
      const message = error?.message ?? ''
      if (!String(message).includes('EADDRINUSE') || attempt === maxAttempts - 1) {
        throw error
      }
      listenPort += 1
    }
  }

  node.services.pubsub.subscribe(DISCOVERY_TOPIC)
  node.services.pubsub.subscribe(CHAT_TOPIC)

  const state = {
    startedAt: Date.now(),
    peerId: node.peerId.toString(),
    topics: [CHAT_TOPIC, FILE_TOPIC, DISCOVERY_TOPIC],
    counters: {
      totalEvents: 0,
      totalMessages: 0,
      byTopic: {},
    },
    roomTypes: {
      messagesByType: {
        public: 0,
        stream: 0,
        ai: 0,
        call: 0,
      },
      messagesByRoom: {},
    },
    invites: {
      total: 0,
      byType: {
        stream: 0,
        call: 0,
        ai: 0,
      },
      byRoom: {},
    },
    analytics: {
      chatMessages: {
        total: 0,
        byRoomType: {},
      },
      invites: {
        total: 0,
        byRoomType: {},
      },
      agentChat: {
        total: 0,
        byVariant: { user: 0, model: 0 },
        byProvider: {},
        byModel: {},
        byRoom: {},
      },
      streamChat: {
        total: 0,
        byRoom: {},
      },
      streamSessions: {
        activeByPeer: {},
        totalMsByPeer: {},
        totalMsByRoom: {},
      },
      billing: {
        freeMinutes: 0,
        paidMinutes: 0,
        byPeer: {},
      },
      streamMinutes: {
        total: 0,
        freeTotal: 0,
        paidTotal: 0,
        byRoom: {},
        byRoomFree: {},
        byRoomPaid: {},
      },
      signals: {
        total: 0,
        byType: {},
      },
    },
    sessionStarts: {},
    onlinePeers: new Set(),
    onlinePeersByTopic: {},
  }

  for (const topic of state.topics) {
    node.services.pubsub.subscribe(topic)
  }

  const handleAnalyticsEvent = (payload) => {
    if (!payload?.event) {
      return
    }

    const event = payload.event
    const roomType = payload.roomType || 'unknown'
    const roomId = payload.roomId || 'unknown'
    const peerId = payload.peerId || 'unknown'

    if (event === 'chat_message_sent') {
      state.analytics.chatMessages.total += 1
      state.analytics.chatMessages.byRoomType[roomType] = (state.analytics.chatMessages.byRoomType[roomType] ?? 0) + 1
      return
    }

    if (event === 'invite_sent') {
      state.analytics.invites.total += 1
      state.analytics.invites.byRoomType[roomType] = (state.analytics.invites.byRoomType[roomType] ?? 0) + 1
      return
    }

    if (event === 'agent_chat_message') {
      const variant = payload.variant === 'model' ? 'model' : 'user'
      state.analytics.agentChat.total += 1
      state.analytics.agentChat.byVariant[variant] = (state.analytics.agentChat.byVariant[variant] ?? 0) + 1
      state.analytics.agentChat.byRoom[roomId] = state.analytics.agentChat.byRoom[roomId] ?? {
        total: 0,
        provider: null,
        modelId: null,
      }
      state.analytics.agentChat.byRoom[roomId].total += 1
      if (payload.provider) {
        state.analytics.agentChat.byRoom[roomId].provider = payload.provider
      }
      if (payload.modelId) {
        state.analytics.agentChat.byRoom[roomId].modelId = payload.modelId
      }
      if (payload.provider) {
        state.analytics.agentChat.byProvider[payload.provider] =
          (state.analytics.agentChat.byProvider[payload.provider] ?? 0) + 1
      }
      if (payload.modelId) {
        state.analytics.agentChat.byModel[payload.modelId] =
          (state.analytics.agentChat.byModel[payload.modelId] ?? 0) + 1
      }
      return
    }

    if (event === 'stream_chat_message') {
      state.analytics.streamChat.total += 1
      state.analytics.streamChat.byRoom[roomId] = (state.analytics.streamChat.byRoom[roomId] ?? 0) + 1
      return
    }

    if (event === 'stream_started' || event === 'stream_viewer_started') {
      const role = payload.role ?? (event === 'stream_started' ? 'host' : 'viewer')
      const key = `${role}:${roomId}:${peerId}`
      state.sessionStarts[key] = payload.timestamp ?? Date.now()
      state.analytics.streamSessions.activeByPeer[peerId] =
        (state.analytics.streamSessions.activeByPeer[peerId] ?? 0) + 1
      return
    }

    if (event === 'stream_ended' || event === 'stream_viewer_ended') {
      const role = payload.role ?? (event === 'stream_ended' ? 'host' : 'viewer')
      const key = `${role}:${roomId}:${peerId}`
      const startedAt = state.sessionStarts[key]
      if (startedAt) {
        const durationMs = Math.max(0, (payload.timestamp ?? Date.now()) - startedAt)
        delete state.sessionStarts[key]
        state.analytics.streamSessions.totalMsByPeer[peerId] =
          (state.analytics.streamSessions.totalMsByPeer[peerId] ?? 0) + durationMs
        state.analytics.streamSessions.totalMsByRoom[roomId] =
          (state.analytics.streamSessions.totalMsByRoom[roomId] ?? 0) + durationMs
      }
      state.analytics.streamSessions.activeByPeer[peerId] = Math.max(
        0,
        (state.analytics.streamSessions.activeByPeer[peerId] ?? 1) - 1,
      )
      return
    }

    if (event === 'billing_minute') {
      const minutes = typeof payload.minutes === 'number' ? payload.minutes : 1
      if (payload.isFree) {
        state.analytics.billing.freeMinutes += minutes
      } else {
        state.analytics.billing.paidMinutes += minutes
      }
      state.analytics.billing.byPeer[peerId] = (state.analytics.billing.byPeer[peerId] ?? 0) + minutes
      return
    }

    if (event === 'stream_minute') {
      const minutes = typeof payload.minutes === 'number' ? payload.minutes : 1
      state.analytics.streamMinutes.total += minutes
      state.analytics.streamMinutes.byRoom[roomId] = (state.analytics.streamMinutes.byRoom[roomId] ?? 0) + minutes

      if (payload.isFree) {
        state.analytics.streamMinutes.freeTotal += minutes
        state.analytics.streamMinutes.byRoomFree[roomId] =
          (state.analytics.streamMinutes.byRoomFree[roomId] ?? 0) + minutes
      } else {
        state.analytics.streamMinutes.paidTotal += minutes
        state.analytics.streamMinutes.byRoomPaid[roomId] =
          (state.analytics.streamMinutes.byRoomPaid[roomId] ?? 0) + minutes
      }
    }
  }

  node.services.pubsub.addEventListener('message', (event) => {
    const topic = event.detail.topic
    state.counters.totalEvents += 1
    state.counters.byTopic[topic] = (state.counters.byTopic[topic] ?? 0) + 1

    const raw = event.detail.data ? new TextDecoder().decode(event.detail.data) : ''

    const analyticsPayload = parseAnalyticsEnvelope(raw)
    if (analyticsPayload) {
      handleAnalyticsEvent(analyticsPayload)
      return
    }

    const signalEnvelope = parseSignalEnvelope(raw)
    if (signalEnvelope) {
      state.analytics.signals.total += 1
      state.analytics.signals.byType[signalEnvelope.kind] =
        (state.analytics.signals.byType[signalEnvelope.kind] ?? 0) + 1
      return
    }

    const decodedRaw = decodeZeroWidth(raw) ?? raw
    const meetredMessage = unwrapMeetredMessage(raw)
    const invite = meetredMessage ? parseInvite(meetredMessage) : null
    const streamChat = parseStreamChat(decodedRaw)
    const agentChat = parseAgentChat(decodedRaw)

    if (invite) {
      state.invites.total += 1
      state.invites.byType[invite.roomType] = (state.invites.byType[invite.roomType] ?? 0) + 1
      state.invites.byRoom[invite.roomId] = (state.invites.byRoom[invite.roomId] ?? 0) + 1
    }

    if (streamChat) {
      state.counters.totalMessages += 1
      state.roomTypes.messagesByType.stream += 1
      state.roomTypes.messagesByRoom[streamChat.roomId] = (state.roomTypes.messagesByRoom[streamChat.roomId] ?? 0) + 1
      return
    }

    if (agentChat) {
      state.counters.totalMessages += 1
      state.roomTypes.messagesByType.ai += 1
      state.roomTypes.messagesByRoom[agentChat.roomId] = (state.roomTypes.messagesByRoom[agentChat.roomId] ?? 0) + 1
      return
    }

    if (invite?.roomType === 'call') {
      state.roomTypes.messagesByType.call += 1
      return
    }

    if (topic === CHAT_TOPIC && meetredMessage && !invite) {
      state.counters.totalMessages += 1
      state.roomTypes.messagesByType.public += 1
    }
  })

  const updateOnlinePeers = () => {
    const online = new Set()
    const byTopic = {}

    state.topics.forEach((topic) => {
      const subscribers = node.services.pubsub.getSubscribers?.(topic) ?? []
      const ids = subscribers.map((peer) => peer.toString())
      byTopic[topic] = ids.length
      ids.forEach((id) => online.add(id))
    })

    const connections = node.getConnections?.() ?? []
    connections.forEach((connection) => {
      const remoteId = connection.remotePeer?.toString?.()
      if (remoteId) {
        online.add(remoteId)
      }
    })

    const selfId = node.peerId.toString()
    online.delete(selfId)

    state.onlinePeers = online
    state.onlinePeersByTopic = byTopic
  }

  updateOnlinePeers()
  const onlineInterval = setInterval(updateOnlinePeers, 5_000)

  const metricsServer = createMetricsServer(state)

  const metricsHttpPort = await listenWithRetry(metricsServer, metricsHost, metricsPort)

  const bootstrapAddrs = parseBootstrapAddrs()

  for (const addr of bootstrapAddrs) {
    try {
      await node.dial(modules.multiaddr(addr))
    } catch (error) {
      console.warn('[archival] failed to dial bootstrap addr', addr, error?.message ?? error)
    }
  }
  return { node, metricsServer, onlineInterval, metricsHttpPort, metricsHttpHost: metricsHost }
}

let instancePromise

async function startMetricsNode() {
  if (shouldSkipMetrics()) {
    return null
  }

  if (!instancePromise) {
    instancePromise = createMetricsNode().catch((error) => {
      instancePromise = undefined
      throw error
    })
  }

  return instancePromise
}

async function stopMetricsNode() {
  if (!instancePromise) {
    return
  }

  try {
    const instance = await instancePromise
    if (instance?.metricsServer) {
      await new Promise((resolve) => instance.metricsServer.close(resolve))
    }
    if (instance?.onlineInterval) {
      clearInterval(instance.onlineInterval)
    }
    if (instance?.node) {
      await instance.node.stop()
    }
  } catch {
    // ignore shutdown failures
  } finally {
    instancePromise = undefined
  }
}

if (require.main === module) {
  startMetricsNode()
    .then((instance) => {
      if (!instance) {
        console.warn('[metrics] skipped starting metrics node')
        return
      }

      const shutdown = async () => {
        await stopMetricsNode()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
    .catch((error) => {
      console.error('failed to start metrics node', error)
      process.exit(1)
    })
}

module.exports = {
  createMetricsNode,
  startMetricsNode,
  stopMetricsNode,
}
