# How the libp2p Network Works

- Peers discover each other via pubsub peer discovery and circuit relays; once connected, they dial directly (WebRTC/WebTransport/WS).
- Public chat uses gossipsub topics; messages are signed and relayed by any subscriber.
- Files travel via a request/response protocol: metadata on pubsub, bytes over a direct protocol stream.
- DMs ride on a custom direct-message protocol (no relays store your content).
- Bootstrap peers only help you find others; they do not archive chat.
- Each peer has a persistent libp2p identity (private key) stored locally; rotating/importing identities changes your peer ID and thus your message history footprint.
