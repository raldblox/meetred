# Security & Privacy Notes

- Messages are signed by the sender; unsigned or invalid messages are ignored.
- There is no central storage: history lives on peers; public chat backfill comes only from peers that were online.
- DMs are point-to-point over encrypted libp2p transports; no servers see your plaintext.
- History purges when peers go offline long enough, reducing the footprint on shared devices.
- File transfers are end-to-end via the file exchange protocol; blobs are never relayed through a server.
