# Metered Browser Extension

A Chrome side panel companion for the Metered web app. It boots the same libp2p stack as the Next.js UI, keeps your peer identity in the browser, lists online peers, and lets you share stream invites in the public chat without opening a new tab.

## Features

- Boots the shared libp2p node and persists the identity key inside the extension storage.
- Quick actions to rotate, back up, or restore the identity so it matches the web app.
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

- **Copy identity key**: stores the base64 private key on your clipboard so it can be pasted into the web app.
- **Restore identity**: paste a key exported from the web app to keep the extension in sync, then the node restarts automatically.

Both flows use the existing `@/lib/identity` helpers so the key format matches the Next.js implementation exactly.

## Automatic identity sync with the web app

`public/content-script.js` mirrors the `uniconnect.peer.identity` entry between the Next.js app's `localStorage` and `chrome.storage.local`. When the web app rotates an identity the content script copies it into `chrome.storage`, the side panel notices the change, and it restarts libp2p with the same key. Likewise, when the extension rotates or imports a key the updated bytes propagate back to the web app.

The manifest currently grants host access to `http://localhost/*` and every `https://` origin so the script can run wherever the Next app is hosted. Trim these patterns inside `public/manifest.json` → `content_scripts.matches`/`host_permissions` if you deploy to a known domain.
