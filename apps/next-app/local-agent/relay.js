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

const HOST = (process.env.LIBP2P_RELAY_HOST ?? '127.0.0.1').trim() || '127.0.0.1'
const PORT = Number.parseInt(process.env.LIBP2P_RELAY_PORT ?? '15002', 10)
const KEY_PATH = process.env.LIBP2P_RELAY_KEY_PATH ?? path.join(__dirname, 'relay.key')

const DISCOVERY_TOPIC =
  (process.env.LIBP2P_DISCOVERY_TOPIC ?? 'universal-connectivity-browser-peer-discovery').trim() ||
  'universal-connectivity-browser-peer-discovery'
const CHAT_TOPIC = (process.env.LIBP2P_CHAT_TOPIC ?? 'universal-connectivity').trim() || 'universal-connectivity'

const loadOrCreateKey = async ({
  generateKeyPair,
  privateKeyFromProtobuf,
  privateKeyToProtobuf,
  uint8ArrayFromString,
  uint8ArrayToString,
}) => {
  if (fs.existsSync(KEY_PATH)) {
    const encoded = fs.readFileSync(KEY_PATH, 'utf8').trim()

    if (encoded) {
      const bytes = uint8ArrayFromString(encoded, 'base64pad')
      return privateKeyFromProtobuf(bytes)
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

const startRelay = async () => {
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

  console.log('local libp2p relay ready')
  console.log(`peer id: ${peerId}`)
  console.log(`listen: ${listenAddrs.join(', ')}`)
  console.log(`relay: ${relayAddrs.join(', ')}`)
  console.log('set NEXT_PUBLIC_LOCAL_RELAY_ADDRS to one or more relay addrs above')

  const shutdown = async () => {
    try {
      await node.stop()
    } finally {
      process.exit(0)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

startRelay().catch((error) => {
  console.error('failed to start relay', error)
  process.exit(1)
})
