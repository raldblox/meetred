# Networking

Meetred uses libp2p to connect browsers into a peer network for discovery and messaging.

Key ideas:
- Each browser has an identity key pair.
- Peers discover each other through bootstrap nodes and pubsub discovery.
- Shared spaces use pubsub topics to distribute messages.
- Direct messages can use direct protocol streams between peers.
- Transports are encrypted so intermediate relays do not see plaintext.

Relays and connectivity:
Browsers are often behind NAT. Relays help connect peers when direct dialing is not possible. Relays forward encrypted traffic.

Media:
Calls and streams use WebRTC media paths. Network conditions, VPNs, and enterprise firewalls can affect quality and connectivity.
