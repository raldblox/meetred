# Metered Browser Extension

A Chrome side panel companion for the Metered web app. It boots the same libp2p stack as the Next.js UI, keeps your peer identity in the browser, lists online peers, and lets you share stream invites in the public chat without opening a new tab.

## Features

- Boots its own libp2p node so it can stay online even when the Next.js app is closed.
- Reads the active web-app peer ID (when a tab is open) so invites always point to the main host.
- Quick actions to rotate, back up, or restore the extension identity.
- Stream tools: copy the `/stream/:peerId` link, open the lobby, or broadcast a `stream_invite` to the public chat topic.
- Live presence list sourced from connections, pubsub subscribers, and recently seen peers.
- CTA to open the full Metered experience in a tab when you need the full chat UI.

## Local development

```
cd apps/browser-extension
npm install
npm run dev
```

Vite serves the side panel at `http://localhost:5173`. While the dev server is running you can load the extension pointing to the `apps/browser-extension` folder (Chrome reloads when files change).

### Configure the target web app

Set `VITE_WEB_APP_URL` before running the dev server/build if your Next.js app runs on a non-default origin:

```bash
# Example: reuse a deployed environment instead of localhost
set VITE_WEB_APP_URL=https://app.metered.chat
npm run dev
```

The value is used when generating the "Open web app" CTA and the stream invite link.

## Production build & installation

1. From `apps/browser-extension` run `npm run build`. The compiled extension lives in `apps/browser-extension/dist`.
2. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
3. Select the `dist` directory. Chrome will register the extension with a side panel icon. Clicking the icon opens the panel.

### Publishing tips

- Update `public/manifest.json` when bumping the version number.
- The background service worker (`public/background.js`) already enables side panel behaviour on click.

## Identity backups

- **Copy identity key**: stores the extension's base64 private key on your clipboard so it can be backed up.
- **Restore identity**: paste a previous extension key; the node restarts automatically with it.

These flows use the same protobuf/key format as the web app, so you can shuttle keys between them if needed without conversion.

## Reading the web-app peer

`public/content-script.js` watches the page's `localStorage` entry `uniconnect.peer.identity` and mirrors it into `chrome.storage.local` under `uniconnect.web.peer.identity`. Tabs on other origins (e.g. `localhost` + production) pick up the same identity because the script hydrates their `localStorage` from the shared chrome storage at `document_start`. The side panel only ever reads `uniconnect.web.peer.identity` to learn the host peer ID; its own libp2p node persists a completely separate key under `uniconnect.extension.identity`. If no host is detected you can click "Sync with web app" in the panel; it will ping every open Metered tab until it finds one running the content script.

The manifest currently grants host access to `http://localhost/*` and every `https://` origin so the script can run wherever the Next app is hosted. Trim these patterns inside `public/manifest.json` -> `content_scripts.matches`/`host_permissions` once you know your production domain.
