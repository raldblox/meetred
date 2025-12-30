# Message history

Meetred has multiple message scopes:
- Public room messages
- Direct messages
- Room-scoped chat, such as stream chat and AI chat

Storage model:
Meetred is designed to avoid centralized message storage by default.

Instead:
- Clients cache recent messages locally, for example in IndexedDB.
- On reconnect, clients may request recent backfill from peers that retained cached messages.

Direct messages:
DM history is stored locally on participant devices. When both participants are online, each can answer history requests for that DM thread.

Integrity:
Messages are signed by senders. Clients verify signatures and ignore invalid payloads.
