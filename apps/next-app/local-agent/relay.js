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
    uint8ToModule,
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
    import('uint8arrays/to-string'),
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
    uint8ArrayToString: uint8ToModule.toString,
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

const HOST = (process.env.LIBP2P_RELAY_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
const PORT = Number.parseInt(process.env.LIBP2P_RELAY_PORT ?? '15002', 10)
const KEY_PATH = process.env.LIBP2P_RELAY_KEY_PATH ?? path.join(__dirname, 'relay.key')

const DISCOVERY_TOPIC =
  (process.env.LIBP2P_DISCOVERY_TOPIC ?? 'universal-connectivity-browser-peer-discovery').trim() ||
  'universal-connectivity-browser-peer-discovery'
const CHAT_TOPIC = (process.env.LIBP2P_CHAT_TOPIC ?? 'universal-connectivity').trim() || 'universal-connectivity'

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

const loadOrCreateKey = async ({
  generateKeyPair,
  privateKeyFromProtobuf,
  privateKeyToProtobuf,
  uint8ArrayFromString,
  uint8ArrayToString,
}) => {
  const relayKeyEnv = (process.env.LIBP2P_RELAY_KEY ?? '').trim()

  if (relayKeyEnv) {
    const bytes = parseEncodedKey(relayKeyEnv, uint8ArrayFromString)
    if (bytes) {
      return privateKeyFromProtobuf(bytes)
    }
  }

  if (fs.existsSync(KEY_PATH)) {
    const encoded = fs.readFileSync(KEY_PATH, 'utf8').trim()

    if (encoded) {
      const bytes = parseEncodedKey(encoded, uint8ArrayFromString)
      if (bytes) {
        return privateKeyFromProtobuf(bytes)
      }
    }
  }

  const key = await generateKeyPair('Ed25519')
  const bytes = privateKeyToProtobuf(key)
  const encoded = uint8ArrayToString(bytes, 'base64pad')

  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true })
  fs.writeFileSync(KEY_PATH, encoded, 'utf8')

  return key
}

const formatRelayAddrs = (addrs, peerId) =>
  addrs.map((addr) => {
    if (addr.includes('/p2p/')) {
      return addr.includes('/p2p-circuit') ? addr : `${addr}/p2p-circuit`
    }

    return `${addr}/p2p/${peerId}/p2p-circuit`
  })

const createRelayNode = async () => {
  const modules = await loadLibp2pModules()
  const privateKey = await loadOrCreateKey(modules)

  const node = await modules.createLibp2p({
    privateKey,
    addresses: {
      listen: [`/ip4/${HOST}/tcp/${PORT}/ws`],
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
  })

  const peerId = node.peerId.toString()
  const listenAddrs = node.getMultiaddrs().map((addr) => addr.toString())
  const relayAddrs = formatRelayAddrs(listenAddrs, peerId)

  node.services.pubsub.subscribe(DISCOVERY_TOPIC)
  node.services.pubsub.subscribe(CHAT_TOPIC)

  return node
}

let instancePromise

const shouldSkipRelay = () => {
  const flag = (process.env.START_LIBP2P_RELAY ?? '').toLowerCase().trim()

  if (flag === '0' || flag === 'false' || flag === 'off') {
    return true
  }

  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    return true
  }

  if (process.env.NEXT_PUBLIC_NODE_ENV !== 'development' && process.env.NODE_ENV !== 'development') {
    return true
  }

  return false
}

async function startLocalRelay() {
  if (shouldSkipRelay()) {
    return null
  }

  if (!instancePromise) {
    instancePromise = createRelayNode().catch((error) => {
      instancePromise = undefined
      throw error
    })
  }

  return instancePromise
}

async function stopLocalRelay() {
  if (!instancePromise) {
    return
  }

  try {
    const node = await instancePromise

    if (node) {
      await node.stop()
    }
  } catch {
    // ignore shutdown failures
  } finally {
    instancePromise = undefined
  }
}

if (require.main === module) {
  startLocalRelay()
    .then((node) => {
      if (!node) {
        console.warn('[local-relay] skipped starting relay')
        return
      }

      const shutdown = async () => {
        await stopLocalRelay()
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
    .catch((error) => {
      console.error('failed to start relay', error)
      process.exit(1)
    })
}

module.exports = {
  startLocalRelay,
  stopLocalRelay,
}
