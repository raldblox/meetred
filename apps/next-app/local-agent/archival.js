const fs = require('node:fs')
const path = require('node:path')

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

const getHost = (value) => (value ?? process.env.LIBP2P_ARCHIVAL_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
const getPort = (value) => Number.parseInt(value ?? process.env.LIBP2P_ARCHIVAL_PORT ?? '15012', 10)
const getKeyPath = (value) => value ?? process.env.LIBP2P_ARCHIVAL_KEY_PATH ?? path.join(__dirname, 'archival.key')
const LOG_LIMIT = Number.parseInt(process.env.LIBP2P_ARCHIVAL_LOG_LIMIT ?? '10000', 10)

const {
  CHAT_TOPIC: DEFAULT_CHAT_TOPIC,
  CHAT_FILE_TOPIC: DEFAULT_FILE_TOPIC,
  PUBSUB_PEER_DISCOVERY: DEFAULT_DISCOVERY_TOPIC,
} = require('./constants')

const DISCOVERY_TOPIC =
  (process.env.LIBP2P_DISCOVERY_TOPIC ?? DEFAULT_DISCOVERY_TOPIC).trim() || DEFAULT_DISCOVERY_TOPIC
const CHAT_TOPIC = (process.env.LIBP2P_CHAT_TOPIC ?? DEFAULT_CHAT_TOPIC).trim() || DEFAULT_CHAT_TOPIC
const FILE_TOPIC = (process.env.LIBP2P_FILE_TOPIC ?? DEFAULT_FILE_TOPIC).trim() || DEFAULT_FILE_TOPIC

const ARCHIVAL_BOOTSTRAP_ADDRS = (process.env.LIBP2P_ARCHIVAL_BOOTSTRAP_ADDRS ?? '').trim()
const DEFAULT_BOOTSTRAP_ADDRS = (process.env.NEXT_PUBLIC_LOCAL_RELAY_ADDRS ?? '').trim()

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
  `${ARCHIVAL_BOOTSTRAP_ADDRS}${ARCHIVAL_BOOTSTRAP_ADDRS && DEFAULT_BOOTSTRAP_ADDRS ? ',' : ''}${DEFAULT_BOOTSTRAP_ADDRS}`
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

const loadOrCreateKey = async (
  { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf, uint8ArrayFromString },
  keyPath,
) => {
  const envKey = (process.env.LIBP2P_ARCHIVAL_KEY ?? '').trim()

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

const shouldSkipArchival = () => {
  const flag = (process.env.START_LIBP2P_ARCHIVAL ?? '').toLowerCase().trim()

  if (flag === '0' || flag === 'false' || flag === 'off') {
    return true
  }

  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    return true
  }

  return false
}

const createArchivalNode = async (options = {}) => {
  const modules = await loadLibp2pModules()
  const host = getHost(options.host)
  const port = getPort(options.port)
  const keyPath = getKeyPath(options.keyPath)
  const privateKey = await loadOrCreateKey(modules, keyPath)

  const node = await modules.createLibp2p({
    privateKey,
    addresses: {
      listen: [`/ip4/${host}/tcp/${port}/ws`],
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

  const state = {
    startedAt: Date.now(),
    peerId: node.peerId.toString(),
    topics: [CHAT_TOPIC, FILE_TOPIC, DISCOVERY_TOPIC],
    logs: [],
  }

  for (const topic of state.topics) {
    node.services.pubsub.subscribe(topic)
  }

  node.services.pubsub.addEventListener('message', (event) => {
    const raw = event.detail.data ? new TextDecoder().decode(event.detail.data) : ''
    const decoded = decodeZeroWidth(raw) ?? raw
    const entry = {
      timestamp: Date.now(),
      topic: event.detail.topic,
      from: event.detail.from?.toString?.(),
      size: event.detail.data?.length ?? 0,
      raw,
      decoded,
    }

    state.logs.push(entry)

    if (state.logs.length > LOG_LIMIT) {
      state.logs.splice(0, state.logs.length - LOG_LIMIT)
    }
  })

  const bootstrapAddrs = parseBootstrapAddrs()

  for (const addr of bootstrapAddrs) {
    try {
      await node.dial(modules.multiaddr(addr))
    } catch (error) {
      console.warn('[archival] failed to dial bootstrap addr', addr, error?.message ?? error)
    }
  }

  return { node, state }
}

let instancePromise

async function startArchivalNode() {
  if (shouldSkipArchival()) {
    return null
  }

  if (!instancePromise) {
    instancePromise = createArchivalNode().catch((error) => {
      instancePromise = undefined
      throw error
    })
  }

  return instancePromise
}

async function stopArchivalNode() {
  if (!instancePromise) {
    return
  }

  try {
    const instance = await instancePromise
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
  startArchivalNode()
    .then((instance) => {
      if (!instance) {
        console.warn('[archival] skipped starting archival node')
        return
      }

      const shutdown = async () => {
        await stopArchivalNode()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
    .catch((error) => {
      console.error('failed to start archival node', error)
      process.exit(1)
    })
}

module.exports = {
  createArchivalNode,
  startArchivalNode,
  stopArchivalNode,
}
