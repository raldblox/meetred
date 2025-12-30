# Threat model

This document outlines what Meetred aims to protect and the boundaries of the system.

Assets:
- Message contents
- Identity keys
- Metadata such as connection patterns

Adversaries:
- Passive network observer
- Malicious participant in a room
- Compromised client device
- Infrastructure compromise of relay or bootstrap nodes

Protections:
- Encrypted transports reduce infrastructure visibility into message contents.
- Message signatures provide integrity against tampering.
- Local-first identity reduces central account takeover risk.

Boundaries:
- Participants can record or copy content they receive.
- Metadata minimization is a goal, but real-time systems have inherent metadata.
- If a client device is compromised, local identity keys can be stolen.
