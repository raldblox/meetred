# Metered Messaging Architecture

This document describes how the Metered app shares the Universal Connectivity network while keeping its own public chat, stream signalling/chat, and agent signalling/chat isolated from the upstream clients.

```
                                    +------------------+
                                    | Universal Relay  |
                                    | + Public Peers   |
                                    +---------+--------+
                                              ^
                                              |
                         libp2p pubsub (shared infra)
                                              |
        +-------------------------------------+-------------------------------+
        |                                     |                               |
 +------+-------+                     +-------+------+                +-------+------+
 | Metered UI  |                     | Stream Stack |                | Agent Stack  |
 | (Chat/DM)   |                     | (Host/View)  |                | (Host/View)  |
 +------+------+-+                   +------+-------+                +------+-------+
        |        \                          |                               |
        |         \                         |                               |
       v          v                        v                               v
  METERED_CHAT_TOPIC   CHAT_TOPIC   CHAT_FILE_TOPIC      STREAM_SIGNAL_TOPIC             AGENT_SIGNAL_TOPIC
 (metered)      (universal)          (metered-stream-signal)         (metered-agent-signal)
        |             |                     |                               |
        |             +-- files stay private because request/response        |
        |                 only happens against Metered peers.                |
        |
        | wrap outbound public-chat payloads in
        | { type: 'metered-chat', app: 'metered', payload: {...}}
        v
  Metered-only lobby feed (UI discards anything
  without app === 'metered').

METERED_CHAT_TOPIC (metered-public-chat) carries wrapped lobby chat. Nodes still subscribe to `CHAT_TOPIC` for UC discovery/legacy, but Metered chat publishes only on the dedicated topic.

STREAM_CHAT_TOPIC (metered-stream-chat) carries
{ type: 'stream_chat', app: 'metered', ... } payloads.

AGENT_CHAT_TOPIC (metered-agent-chat) carries
{ type: 'agent_chat', app: 'metered-agent', ... } payloads.
```

## Channel Summary

| Feature            | Topic / Protocol                      | Envelope                                       | Visible To |
|--------------------|---------------------------------------|------------------------------------------------|------------|
| Public chat        | `METERED_CHAT_TOPIC` (`metered-public-chat`) | `{ type: CHAT_MESSAGE_WRAPPER, app: 'metered' }` | Metered lobby UI only |
| Public file shares | `CHAT_FILE_TOPIC` + `FILE_EXCHANGE_PROTOCOL` | File metadata hits topic, bytes served via protocol | Metered peers answering the protocol |
| Stream signalling  | `STREAM_SIGNAL_TOPIC` (`metered-stream-signal`) | `{ type: 'stream-signal', app: 'metered' }` | Metered stream host/viewers |
| Stream chat        | `STREAM_CHAT_TOPIC` (`metered-stream-chat`) | `{ type: 'stream_chat', app: 'metered' }` | Metered stream UI |
| Agent signalling   | `AGENT_SIGNAL_TOPIC` (`metered-agent-signal`) | `{ type: 'agent-signal', app: 'metered-agent' }` | Metered agent host/viewers |
| Agent chat         | `AGENT_CHAT_TOPIC` (`metered-agent-chat`) | `{ type: 'agent_chat', app: 'metered-agent' }` | Metered agent UI |

## How Isolation Works

1. **Topic-level isolation for stream and agent traffic.** All signalling and chat for these features use Metered-only topics, so universal peers never subscribe to or see the payloads.
2. **Dual-topic strategy for the lobby.** Metered publishes lobby chat on `METERED_CHAT_TOPIC`, ensuring UC clients never render the payload. Nodes also subscribe to `CHAT_TOPIC` for UC relay/discovery, but ignore content that lacks the Metered envelope.
3. **Context filters.** `ChatContext` inspects the incoming topic + envelope. If a message arrives on a Metered-only topic without the correct `app`, it is discarded before it touches the UI or state.

This approach lets Metered share the Universal Connectivity infrastructure while preventing accidental leakage of stream/agent data into the public rooms and vice versa.
