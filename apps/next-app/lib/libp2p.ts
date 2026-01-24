import type { Connection, Message, SignedMessage, PeerId, Libp2p, PrivateKey } from '@libp2p/interface'
import type { Libp2pType } from '@/context/libp2p-ctx'
import type { BootPhase, BootPhaseState, BootStatusUpdate } from './boot-status'

import {
  createDelegatedRoutingV1HttpApiClient,
  DelegatedRoutingV1HttpApiClient,
} from '@helia/delegated-routing-v1-http-api-client'
import { createLibp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
import { FaultTolerance } from '@libp2p/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { Multiaddr, multiaddr } from '@multiformats/multiaddr'
import { sha256 } from 'multiformats/hashes/sha2'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { webSockets } from '@libp2p/websockets'
import { webTransport } from '@libp2p/webtransport'
import { webRTC, webRTCDirect } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { ping } from '@libp2p/ping'
import first from 'it-first'

import {
  AGENT_CHAT_TOPIC,
  AGENT_SIGNAL_TOPIC,
  BOOTSTRAP_PEER_IDS,
  CHAT_FILE_TOPIC,
  CHAT_TOPIC,
  PUBSUB_PEER_DISCOVERY,
  STREAM_CHAT_TOPIC,
  STREAM_SIGNAL_TOPIC,
} from '../config/constants'

import { forComponent, enable } from './logger'
import { directMessage } from './direct-message'
import { loadOrCreatePrivateKey } from './identity'

const log = forComponent('libp2p')
const LOCAL_RELAY_ENV = 'NEXT_PUBLIC_LOCAL_RELAY_ADDRS'

const multiaddrDialPriority = (addr: Multiaddr) => {
  const protos = addr.protoNames()

  if (protos.includes('webrtc')) return 0
  if (protos.includes('webrtc-direct')) return 1
  if (protos.includes('webtransport')) return 2
  if (protos.includes('ws') || protos.includes('wss')) return 3

  return 4
}

// Try discovered addresses in an order that favours browser-friendly transports first.
const dialDiscoveredAddrs = async (libp2p: Libp2p, addrs: Multiaddr[]): Promise<void> => {
  if (addrs.length === 0) {
    return
  }

  const sorted = [...addrs].sort((a, b) => multiaddrDialPriority(a) - multiaddrDialPriority(b))

  for (const addr of sorted) {
    try {
      log(`attempting to dial discovered multiaddr: %o`, addr)
      await libp2p.dial(addr)

      return // as soon as we get one connection, stop trying the rest
    } catch (error) {
      log.error(`failed to dial discovered multiaddr %o: %o`, addr, error)
    }
  }
}

const ensureRelayReservations = async (libp2p: Libp2p, relayListenAddrs: string[]): Promise<void> => {
  for (const addr of relayListenAddrs) {
    try {
      const ma = multiaddr(addr)

      log(`ensuring relay reservation via %a`, ma)
      await libp2p.dial(ma)
    } catch (error) {
      log.error('failed to create relay reservation on %s: %o', addr, error)
    }
  }
}

const shouldUseLocalRelay = (): boolean => {
  if (process.env.NEXT_PUBLIC_NODE_ENV === 'development' || process.env.NODE_ENV === 'development') {
    return true
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname

    return host === 'localhost' || host === '127.0.0.1'
  }

  return false
}

const parseLocalRelayAddrs = (): string[] => {
  if (!shouldUseLocalRelay()) {
    return []
  }

  const raw = process.env[LOCAL_RELAY_ENV] ?? ''

  if (!raw) {
    return []
  }

  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.includes('/p2p-circuit') ? entry : `${entry}/p2p-circuit`))
}

export interface StartLibp2pOptions {
  forceNewIdentity?: boolean
  privateKey?: PrivateKey
  onStatus?: (update: BootStatusUpdate) => void
}

const setBootStatusFactory =
  (reporter?: (update: BootStatusUpdate) => void) => (phase: BootPhase, state: BootPhaseState, message?: string) => {
    reporter?.({ phase, state, message })
  }

export async function startLibp2p(options: StartLibp2pOptions = {}): Promise<Libp2pType> {
  // enable verbose logging in browser console to view debug logs
  enable('ui*,libp2p*,-libp2p:connection-manager*,-*:trace')

  const setBootStatus = setBootStatusFactory(options.onStatus)

  setBootStatus('resolving-relays', 'active', 'Resolving delegated relay addresses')
  const delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')

  const localRelayAddrs = parseLocalRelayAddrs()
  const delegatedRelayAddrs = await resolveRelayListenAddrs(delegatedClient)
  const relayListenAddrs = Array.from(new Set([...localRelayAddrs, ...delegatedRelayAddrs]))

  setBootStatus(
    'resolving-relays',
    'complete',
    relayListenAddrs.length > 0
      ? `Using ${localRelayAddrs.length} local, ${delegatedRelayAddrs.length} delegated relay${
          relayListenAddrs.length > 1 ? 's' : ''
        }`
      : 'No relays resolved (continuing without relays)',
  )

  log('starting libp2p with relayListenAddrs: %o', relayListenAddrs)

  let libp2p: Libp2pType

  setBootStatus('loading-identity', 'active', 'Loading or creating identity')
  const privateKey = options.privateKey ?? (await loadOrCreatePrivateKey({ forceNew: options.forceNewIdentity }))

  setBootStatus('loading-identity', 'complete', 'Identity ready')

  setBootStatus('starting-libp2p', 'active', 'Spinning up browser node')
  libp2p = await createLibp2p({
    privateKey,
    addresses: {
      listen: [
        // 👇 Listen for webRTC connection
        '/webrtc',
        ...relayListenAddrs,
      ],
    },
    transportManager: {
      // tolerate individual listen failures instead of aborting startup
      faultTolerance: FaultTolerance.NO_FATAL,
    },
    transports: [
      webTransport(),
      webSockets(),
      webRTC(),
      // 👇 Required to estalbish connections with peers supporting WebRTC-direct, e.g. the Rust-peer
      webRTCDirect(),
      // 👇 Required to create circuit relay reservations in order to hole punch browser-to-browser WebRTC connections
      circuitRelayTransport(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: {
      denyDialMultiaddr: async () => false,
    },
    peerDiscovery: [
      pubsubPeerDiscovery({
        interval: 3_000,
        topics: [PUBSUB_PEER_DISCOVERY],
        listenOnly: false,
      }),
    ],
    services: {
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true,
        msgIdFn: msgIdFnStrictNoSign,
        ignoreDuplicatePublishError: true,
      }),
      // Delegated routing helps us discover the ephemeral multiaddrs of the dedicated go and rust bootstrap peers
      // This relies on the public delegated routing endpoint https://docs.ipfs.tech/concepts/public-utilities/#delegated-routing
      delegatedRouting: () => delegatedClient,
      identify: identify(),
      // Custom protocol for direct messaging
      directMessage: directMessage(),
      ping: ping(),
    },
  })

  if (!libp2p) {
    throw new Error('Failed to create libp2p node')
  }

  setBootStatus('starting-libp2p', 'complete', `Node ready as ${libp2p.peerId.toString()}`)

  setBootStatus('subscribing-topics', 'active', 'Joining pubsub topics')
  const topics = [
    CHAT_TOPIC,
    CHAT_FILE_TOPIC,
    PUBSUB_PEER_DISCOVERY,
    STREAM_SIGNAL_TOPIC,
    STREAM_CHAT_TOPIC,
    AGENT_SIGNAL_TOPIC,
    AGENT_CHAT_TOPIC,
  ]
  const uniqueTopics = Array.from(new Set(topics))

  uniqueTopics.forEach((topic) => libp2p.services.pubsub.subscribe(topic))
  setBootStatus('subscribing-topics', 'complete', 'Subscribed to chat and discovery topics')

  libp2p.addEventListener('self:peer:update', ({ detail: { peer } }) => {
    const multiaddrs = peer.addresses.map(({ multiaddr }) => multiaddr)

    log(`changed multiaddrs: peer ${peer.id.toString()} multiaddrs: ${multiaddrs}`)
  })

  // Make sure we reserve slots on the relays we resolved above so that other peers can discover/dial us.
  if (relayListenAddrs.length > 0) {
    setBootStatus('reserving-relays', 'active', 'Creating relay reservations')
    ensureRelayReservations(libp2p, relayListenAddrs)
      .then(() => setBootStatus('reserving-relays', 'complete', 'Relay reservations ready'))
      .catch((error) => {
        setBootStatus('reserving-relays', 'error', 'Unable to reserve relays')
        log.error('failed to ensure relay reservations %o', error)
      })
  } else {
    setBootStatus('reserving-relays', 'complete', 'No relay reservations required')
  }

  setBootStatus('waiting-for-peers', 'active', 'Waiting for discovery events')
  let peerDiscoveryResolved = false
  let peerDiscoveryTimeout: ReturnType<typeof setTimeout> | undefined
  const finishPeerDiscovery = (state: BootPhaseState, message?: string) => {
    if (peerDiscoveryResolved) {
      return
    }
    peerDiscoveryResolved = true
    if (peerDiscoveryTimeout) {
      clearTimeout(peerDiscoveryTimeout)
    }
    setBootStatus('waiting-for-peers', state, message)
  }

  peerDiscoveryTimeout = setTimeout(() => {
    finishPeerDiscovery('complete', 'Peer discovery timed out, continuing without peers')
  }, 15_000)

  // 👇 explicitly dial peers discovered via pubsub
  libp2p.addEventListener('peer:discovery', (event) => {
    const { multiaddrs, id } = event.detail

    finishPeerDiscovery('complete', `Discovered peer ${id.toString()}`)

    if (libp2p.getConnections(id)?.length > 0) {
      log(`Already connected to peer %s. Will not try dialling`, id)

      return
    }

    dialDiscoveredAddrs(libp2p, multiaddrs)
  })

  libp2p.addEventListener('peer:connect', ({ detail }) => {
    finishPeerDiscovery('complete', `Connected to peer ${detail.toString()}`)
  })

  return libp2p
}

// message IDs are used to dedupe inbound messages
// every agent in network should use the same message id function
// messages could be perceived as duplicate if this isnt added (as opposed to rust peer which has unique message ids)
export async function msgIdFnStrictNoSign(msg: Message): Promise<Uint8Array> {
  var enc = new TextEncoder()

  const signedMessage = msg as SignedMessage
  const encodedSeqNum = enc.encode(signedMessage.sequenceNumber.toString())

  return await sha256.encode(encodedSeqNum)
}

export const connectToMultiaddr = (libp2p: Libp2p) => async (multiaddr: Multiaddr) => {
  log(`dialling: %a`, multiaddr)
  try {
    const conn = await libp2p.dial(multiaddr)

    log('connected to %p on %a', conn.remotePeer, conn.remoteAddr)

    return conn
  } catch (e) {
    log.error('failed to dial multiaddr %o: %o', multiaddr, e)
    throw e
  }
}

export async function refreshPeerDiscovery(libp2p: Libp2pType): Promise<void> {
  const payload = new TextEncoder().encode(`refresh:${Date.now()}`)

  await libp2p.services.pubsub.publish(PUBSUB_PEER_DISCOVERY, payload)
}

// Function which resolves PeerIDs of rust/go bootstrap nodes to multiaddrs dialable from the browser
// Returns both the dialable multiaddrs in addition to the relay
async function getRelayListenAddrs(client: DelegatedRoutingV1HttpApiClient): Promise<string[]> {
  const peers = await Promise.all(BOOTSTRAP_PEER_IDS.map((peerId) => first(client.getPeers(peerIdFromString(peerId)))))

  const relayListenAddrs = []

  for (const p of peers) {
    if (p && p.Addrs.length > 0) {
      for (const maddr of p.Addrs) {
        const protos = maddr.protoNames()

        // Note: narrowing to Secure WebSockets and IP4 addresses to avoid potential issues with ipv6
        // https://github.com/libp2p/js-libp2p/issues/2977
        if (protos.includes('tls') && protos.includes('ws')) {
          if (maddr.nodeAddress().address === '127.0.0.1') continue // skip loopback
          relayListenAddrs.push(getRelayListenAddr(maddr, p.ID))
        }
      }
    }
  }

  return relayListenAddrs
}

// Constructs a multiaddr string representing the circuit relay v2 listen address for a relayed connection to the given peer.
const getRelayListenAddr = (maddr: Multiaddr, peer: PeerId): string =>
  `${maddr.toString()}/p2p/${peer.toString()}/p2p-circuit`

export const getFormattedConnections = (connections: Connection[]) =>
  connections.map((conn) => ({
    peerId: conn.remotePeer,
    protocols: [...new Set(conn.remoteAddr.protoNames())],
  }))

// Resolve relay addresses but never fail libp2p startup on slow/failed delegated routing.
const resolveRelayListenAddrs = async (client: DelegatedRoutingV1HttpApiClient): Promise<string[]> => {
  try {
    return await withTimeout(getRelayListenAddrs(client), 10_000)
  } catch (error) {
    log.error('failed to resolve relay listen addrs, continuing without bootstrap relays %o', error)

    return []
  }
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}
