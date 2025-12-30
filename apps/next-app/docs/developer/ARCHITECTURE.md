# Architecture

This document provides a practical architecture view of Meetred.

Core pieces:
- UI: public room, DMs, personal rooms (stream, call, AI), identity manager
- Identity: local key material used for signing and stable identity
- Networking: peer networking for discovery and message distribution
- Media: real-time browser media paths for calls and streams
- Storage: local storage for identity and recent history caching
- Optional services: relay, TURN, bootstrap nodes to improve connectivity

Public room flow:
1. Client loads identity or generates one.
2. Client connects to the peer network.
3. Client subscribes to public room topics.
4. Messages are signed and distributed to subscribers.
5. Clients may request recent backfill from peers that retained it locally.

Posting a room card:
The Stream, Call, and AI buttons publish an invite payload to the public room that resolves to the host’s personal room route.
