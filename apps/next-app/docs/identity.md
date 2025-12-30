# Identity & Keys

- Your libp2p identity is a private key stored locally by the UI; it defines your peer ID and is used to sign messages.
- To reuse your identity, export/import the encoded key via the UI (Import Identity). This keeps your peer ID stable across devices or resets.
- To regenerate a new identity, choose Rotate Identity in the UI. This creates a new key/peer ID and your prior message history will not carry over.
- If you clear site data or lose the key, there is no recovery from the network—peers do not store your identity.
- Keep exported keys safe: anyone importing them can impersonate your peer ID and read responses intended for you.
