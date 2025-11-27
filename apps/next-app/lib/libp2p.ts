import type { Connection, Message, SignedMessage, PeerId, Libp2p } from '@libp2p/interface'
import type { Libp2pType } from '@/context/libp2p-ctx'

import {
  createDelegatedRoutingV1HttpApiClient,
  DelegatedRoutingV1HttpApiClient,
} from '@helia/delegated-routing-v1-http-api-client'
import { createLibp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
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

import { BOOTSTRAP_PEER_IDS, CHAT_FILE_TOPIC, CHAT_TOPIC, PUBSUB_PEER_DISCOVERY } from './constants'
import { forComponent, enable } from './logger'
import { directMessage } from './direct-message'
import { loadOrCreatePrivateKey } from './identity'

const log = forComponent('libp2p')

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

export interface StartLibp2pOptions {
  forceNewIdentity?: boolean
}

export async function startLibp2p(options: StartLibp2pOptions = {}): Promise<Libp2pType> {
  // enable verbose logging in browser console to view debug logs
  enable('ui*,libp2p*,-libp2p:connection-manager*,-*:trace')

  const delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')

  const relayListenAddrs = await getRelayListenAddrs(delegatedClient)

  log('starting libp2p with relayListenAddrs: %o', relayListenAddrs)

  let libp2p: Libp2pType

  const privateKey = await loadOrCreatePrivateKey({ forceNew: options.forceNewIdentity })

  libp2p = await createLibp2p({
    privateKey,
    addresses: {
      listen: [
        // 👇 Listen for webRTC connection
        '/webrtc',
        ...relayListenAddrs,
      ],
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
        interval: 10_000,
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

  libp2p.services.pubsub.subscribe(CHAT_TOPIC)
  libp2p.services.pubsub.subscribe(CHAT_FILE_TOPIC)
  libp2p.services.pubsub.subscribe(PUBSUB_PEER_DISCOVERY)

  libp2p.addEventListener('self:peer:update', ({ detail: { peer } }) => {
    const multiaddrs = peer.addresses.map(({ multiaddr }) => multiaddr)

    log(`changed multiaddrs: peer ${peer.id.toString()} multiaddrs: ${multiaddrs}`)
  })

  // 👇 explicitly dial peers discovered via pubsub
  libp2p.addEventListener('peer:discovery', (event) => {
    const { multiaddrs, id } = event.detail

    if (libp2p.getConnections(id)?.length > 0) {
      log(`Already connected to peer %s. Will not try dialling`, id)

      return
    }

    dialDiscoveredAddrs(libp2p, multiaddrs)
  })

  // Make sure we reserve slots on the relays we resolved above so that other peers can discover/dial us.
  ensureRelayReservations(libp2p, relayListenAddrs).catch((error) =>
    log.error('failed to ensure relay reservations %o', error),
  )

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
