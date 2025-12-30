# AI integration

Meetred AI rooms let a host attach a model provider and stream responses into the room.

Local models:
Many local tools expose an OpenAI-compatible HTTP API. A host can connect to a local endpoint and forward prompts from the room.

Implementation notes:
- Prefer localhost or a trusted LAN.
- Treat the local endpoint like a private service.
- Consider a host-side proxy to avoid exposing local ports.

API key mode:
If the host uses an API key provider, treat the key as sensitive.

Implementation notes:
- Best practice is to keep the key out of the browser and route requests through a host-controlled proxy.
- If running in-browser, avoid logging the key and provide a clear forget key option.

Reliability:
AI rooms should clearly show connected state, model name when available, and error states.
