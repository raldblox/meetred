# Data retention

Meetred is designed to minimize centralized retention of messages by default.

Public room:
Public room messages are distributed to connected participants. Clients may cache recent messages locally. Backfill depends on peers that retained those messages.

Direct messages:
DMs are stored locally on participant devices. Backfill depends on participant availability and local retention policy.

Room chat:
Room-scoped chat is shared with participants of that room scope. Retention depends on client-side caching unless additional storage features are introduced.

Implication:
Meetred trades guaranteed centralized archives for a live-first design that reduces central storage and improves privacy. Features like identity backups and export options can improve usability over time.
