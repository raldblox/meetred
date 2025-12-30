# Direct Messages & History Backfill

- DM history is stored only in the peers’ browsers (IndexedDB/memory); no server copy exists.
- When two peers are online together, each acts as a temporary archiver and can answer history requests from the other.
- If both peers go offline for a while (and timers expire), the DM thread is purged.
- Reloads are tolerated because we keep a grace window before purging; reconnect within the window to preserve history.
- To fetch DM history, the UI sends a direct `history_request` to the peer and merges the response when it arrives.
