# metered

## Local Model Agent

Remote deployments (for example https://meetred.vercel.app) cannot talk directly to LM Studio running on a host
machine. The Next.js app now starts a local Fastify proxy automatically whenever you run `npm run dev` or
`npm run start`, so you only need to deploy/start one process. The proxy listens on `http://127.0.0.1:4312` and forwards
requests to LM Studio at `http://127.0.0.1:1234`.

Environment variables:

- `LM_AGENT_TARGET` – override the LM Studio base URL (defaults to `http://127.0.0.1:1234`).
- `LM_AGENT_PORT` / `LM_AGENT_HOST` – change the proxy binding (defaults to `127.0.0.1:4312`).
- `LM_AGENT_SECRET` – optional secret used to encrypt stored OpenAI API keys.
- `START_LM_AGENT=0` – opt out of starting the proxy (useful on Vercel or other serverless hosts).

Once the proxy is running, the host can load the web app, connect their local model, and stream it to viewers via
libp2p/WebRTC without running a separate service.

### OpenAI Provider

Hosts can also connect OpenAI chat models through the same local proxy. In the Agent Manager panel choose **OpenAI**,
enter your OpenAI API key, and click **Connect**. The proxy encrypts the key using `LM_AGENT_SECRET` and keeps it in
memory so it never leaves the machine, while responses stream to everyone in the agent room just like LM Studio.
