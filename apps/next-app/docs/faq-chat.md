# Chat FAQ

- **Why did my messages disappear?** History only exists on peers; if everyone goes offline past the grace window, history is purged.
- **Why don’t I see old public chat?** Backfill depends on connected peers acting as archivers; if none are online with history, you see an empty feed.
- **Are my DMs stored on a server?** No. DMs are stored only on the peers in the conversation.
- **Why do I see a sync spinner?** We’re requesting history from connected peers; it clears when responses arrive or attempts stop.
- **How do files work?** We gossip file metadata, then download bytes directly from the sender over the file protocol.
