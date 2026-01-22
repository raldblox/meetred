# Archival Remote Node (ARN)

The Archival Remote Node (ARN) is the public backbone for discovery/signaling, backfill, and
decentralized transparent analytics. PostHog and similar services are optional downstream sinks,
not the system of record.

ARN provides a foolproof-by-design analytics plane that is visible to everyone while remaining privacy-aware.
It complements (not replaces) the local relay used for offline/localhost development.

## What ARN Does

- Provides public discovery/signaling and relay assistance for internet deployments.
- Captures room/session lifecycle events for backfill and transparent analytics.
- Emits composable analytics events to optional sinks (PostHog, etc).
- Keeps PII minimal and supports redaction and sampling.
- Powers a public `/metrics` view derived from the same event stream.

## What ARN Does Not Do

- It does not capture or relay media streams (WebRTC media is end-to-end between peers).
- It does not store raw chat or media payloads by default.

## How ARN Works

1) Browser clients publish signaling and room lifecycle events to libp2p pubsub topics.
2) ARN subscribes to those topics and normalizes events into a stable schema.
3) Events are written to the transparent ledger and optionally forwarded to sinks.
4) Clients read public metrics and can request backfill via the API.

## Transparent Ledger

ARN writes normalized events to a transparent, append-only ledger. This ledger is the canonical source of truth
for metrics, audits, and backfill. Public metrics are derived directly from this ledger.

## Event Schema (Composable)

All events should have:
- `event_name` (string)
- `occurred_at` (ISO8601 or Unix ms)
- `room_id` (string; can be streamId/hostPeerId or a logical room slug)
- `peer_id` (string; optional for room-level events)
- `session_id` (string; logical session per room + host lifecycle)
- `client_id` (string; optional anonymized ID)
- `app_id` (string; e.g., "meetred")
- `version` (string; schema version)
- `props` (object; event-specific fields)

Core events:

- `room_created`
  - `props`: { `host_peer_id`, `room_type`, `room_visibility` }
- `room_joined`
  - `props`: { `peer_role`, `transport`, `is_relayed` }
- `room_left`
  - `props`: { `peer_role`, `reason`, `duration_ms` }
- `host_started`
  - `props`: { `host_peer_id`, `stream_type` }
- `host_ended`
  - `props`: { `host_peer_id`, `end_reason`, `duration_ms` }
- `session_active_minute`
  - `props`: { `minute_index`, `peer_count`, `active_viewers` }
- `paid_gating_approved`
  - `props`: { `amount`, `currency`, `gate_type` }
- `receipt_confirmed`
  - `props`: { `amount`, `currency`, `tx_id`, `confirmations` }
- `paid_minutes`
  - `props`: { `minutes`, `rate`, `currency` }
- `unique_users`
  - `props`: { `unique_count`, `window` }

Additional analytics:
- `peer_discovered`
- `peer_connected`
- `peer_disconnected`
- `message_sent` (only metadata; no content)
- `message_received` (only metadata; no content)
- `file_shared` (metadata only)
- `stream_quality` (bitrate, jitter, packet loss)
- `error_event` (normalized errors)

## Tracking Integration Points

These points reflect where normalized events originate in the app:

- `context/stream-ctx.tsx`
  - Host start/end, viewer join/leave, active minute ticks.
- `context/chat-ctx.tsx`
  - Message metadata (sent/received).
- `hooks/usePeerPresence.ts`
  - Peer connect/disconnect.
- `hooks/usePayPerMinute.ts`
  - Gating approved, receipt confirmed, paid minutes.
- `context/libp2p-ctx.tsx`
  - Room creation and identity start (when defined in flow).

## Optional Analytics Sinks

PostHog works well as an optional free-tier sink:
- Use **PostHog Product Analytics** (events + dashboards).
- Avoid Session Replay initially to reduce cost/PII.
- Consider Feature Flags only if you need A/B tests.

Alternative sinks:
- **RudderStack** or **Segment** for routing events to multiple sinks.
- Keep event schema stable and sink-agnostic.

## Composable Tracking

Define a small tracking interface that supports multiple sinks:

```ts
type TrackEvent = {
  event_name: string
  occurred_at: string
  room_id?: string
  peer_id?: string
  session_id?: string
  client_id?: string
  app_id: string
  version: string
  props?: Record<string, unknown>
}

interface AnalyticsSink {
  track: (event: TrackEvent) => Promise<void> | void
}
```

Composition rules:
- Clients emit the same normalized events regardless of sinks.
- ARN persists every event to the ledger.
- Sinks are downstream consumers and can be added/removed without schema changes.

## Backfill

Backfill API should support:
- `GET /rooms/:roomId/events?since=...&limit=...`
- `GET /rooms/:roomId/summary`
- `GET /rooms/:roomId/participants`

Backfill respects room permissions and anonymization policy.

## Privacy and Safety

- Raw message content is not stored by default.
- PII is stripped or hashed before storage.
- Retention windows are enforced.
- Clients can opt out of analytics.

## Public Metrics UI

The `/metrics` page aggregates the transparent ledger into a public UI:
- Live active rooms, active users, and host sessions.
- Paid minutes and revenue summaries (if enabled).
- Room join/leave rates and retention curves.
- Error rates and connectivity health.

These metrics are derived from the same ledger used for backfill to guarantee transparency.
