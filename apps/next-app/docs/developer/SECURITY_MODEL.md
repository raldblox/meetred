# Security model

Integrity:
- Messages are signed by the sender.
- Clients verify signatures and ignore invalid payloads.

Confidentiality:
- DMs use direct peer connections over encrypted transports.
- Public room messages are public by design.
- Room-scoped chat is shared with participants in that room scope.

Storage and retention:
- Central storage of message history is not the default.
- Clients can keep local caches for usability.
- Purging local caches reduces footprint on shared devices.

Boundaries:
- A participant can record, screenshot, or copy what they receive.
- Client compromise can expose local keys or cached messages.
- Network metadata can be revealed in real-time systems depending on transport and configuration.
