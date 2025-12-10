import { useCallback, useMemo, useState } from 'react'
import { Copy, ExternalLink, Loader2, Send, Users } from 'lucide-react'

import './App.css'

import { ExtensionLibp2pProvider, useExtensionLibp2p } from './context/libp2p'
import { usePeerPresence } from './hooks/usePeerPresence'
import { PeerList } from './components/PeerList'
import { CHAT_TOPIC } from '@/config/constants'
import { useWebPeerId } from './hooks/useWebPeerId'

const DEFAULT_WEB_APP_URL =
  (import.meta.env.VITE_WEB_APP_URL as string | undefined) ?? 'https://meetred.vercel.app'

const openInNewTab = (url: string) => window.open(url, '_blank', 'noreferrer')

interface SpecialPeerProps {
  label: string
  peerId: string | null
  role: 'you' | 'assistant'
}

function SpecialPeer({ label, peerId, role }: SpecialPeerProps) {
  return (
    <div className="special-peer">
      <div>
        <p className="special-peer__label">{label}</p>
        <p className="special-peer__id">{peerId || 'Not connected'}</p>
      </div>
      <span className={`role-pill ${role === 'assistant' ? 'role-pill--assistant' : 'role-pill--host'}`}>
        {role === 'assistant' ? 'Assistant' : 'You'}
      </span>
    </div>
  )
}

function AppShell() {
  const { libp2p, status, error, restart } = useExtensionLibp2p()
  const { peers, connectedCount, subscribedCount } = usePeerPresence(libp2p)
  const { peerId: webPeerId, refresh: refreshWebPeerId, syncing: syncingWebPeer } = useWebPeerId()

  const extensionPeerId = libp2p?.peerId.toString() ?? ''
  const hostPeerId = webPeerId ?? extensionPeerId
  const usingWebPeer = Boolean(webPeerId)

  const [linkStatus, setLinkStatus] = useState<'idle' | 'copied'>('idle')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [manualSyncFeedback, setManualSyncFeedback] = useState<'success' | 'error' | null>(null)

  const streamLink = useMemo(() => {
    if (!hostPeerId) {
      return ''
    }

    try {
      const url = new URL(DEFAULT_WEB_APP_URL)
      url.pathname = `/stream/${hostPeerId}`
      url.search = ''
      url.hash = ''

      return url.toString()
    } catch {
      return `${DEFAULT_WEB_APP_URL.replace(/\/$/, '')}/stream/${hostPeerId}`
    }
  }, [hostPeerId])

  const canUseStreamActions = Boolean(hostPeerId)

  const copyStreamLink = async () => {
    if (!streamLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(streamLink)
      setLinkStatus('copied')
      setTimeout(() => setLinkStatus('idle'), 2000)
    } catch {
      // ignore clipboard failures silently
    }
  }

  const handleManualSync = useCallback(async () => {
    setManualSyncFeedback(null)

    try {
      const synced = await refreshWebPeerId()

      setManualSyncFeedback(synced ? 'success' : 'error')
    } catch {
      setManualSyncFeedback('error')
    }
  }, [refreshWebPeerId])

  const handleSendStreamInvite = async () => {
    if (!libp2p || !hostPeerId) {
      setInviteStatus('error')
      setInviteError('Open the Metered web app and sync your host ID before broadcasting.')

      return
    }

    setInviteStatus('sending')
    setInviteError(null)

    try {
      const payload = JSON.stringify({
        type: 'stream_invite',
        streamId: hostPeerId,
        hostPeerId,
        createdAt: Date.now(),
      })

      await libp2p.services.pubsub.publish(CHAT_TOPIC, new TextEncoder().encode(payload))
      setInviteStatus('success')
      setTimeout(() => setInviteStatus('idle'), 2200)
    } catch (err: any) {
      setInviteStatus('error')
      setInviteError(err?.message ?? 'Failed to send invite')
    }
  }

  if (status === 'booting') {
    return (
      <div className="card loading-card">
        <Loader2 className="spinner" size={20} />
        <p>Connecting to the Metered P2P network.</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="card error-card">
        <p>We could not start the P2P node.</p>
        {error && <pre className="error-card__details">{error}</pre>}
        <button className="button button--primary" type="button" onClick={() => restart()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <section className="card">
        <header className="card__title">Stream tools</header>
        <div className="card__body gap-5">
          <div className="host-summary">
            <div>
              <p className="helper-text">Broadcast identity</p>
              <div className="mono-field host-field">
                <span>{hostPeerId || 'Waiting for host…'}</span>
                <span className={`role-pill ${usingWebPeer ? 'role-pill--host' : 'role-pill--assistant'}`}>
                  {usingWebPeer ? 'Web app host' : 'Assistant' }
                </span>
              </div>
            </div>
            <button className="button button--ghost button--xs" disabled={syncingWebPeer} type="button" onClick={handleManualSync}>
              {syncingWebPeer ? 'Syncing…' : 'Sync with web app'}
            </button>
          </div>
          {manualSyncFeedback === 'error' && (
            <p className="status-note status-note--error">Unable to find a live Metered tab. Open the web app and try again.</p>
          )}
          {manualSyncFeedback === 'success' && (
            <p className="status-note status-note--success">Host ID synced from web app.</p>
          )}
          {!usingWebPeer && (
            <p className="status-note status-note--warning">
              Currently using the assistant identity. Open the Metered app so invites use your public host ID.
            </p>
          )}
          <div>
            <p className="helper-text">Stream room link</p>
            <div className="mono-field">
              <span>{streamLink || 'Open the Metered web app to generate a stream link.'}</span>
              <button className="button button--ghost" disabled={!canUseStreamActions} type="button" onClick={copyStreamLink}>
                <Copy size={16} /> {linkStatus === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="actions">
            <button className="button button--primary" disabled={!canUseStreamActions} type="button" onClick={() => openInNewTab(streamLink)}>
              <ExternalLink size={16} /> Open stream lobby
            </button>
            <button
              className="button button--ghost"
              disabled={!canUseStreamActions || inviteStatus === 'sending'}
              type="button"
              onClick={handleSendStreamInvite}
            >
              <Send size={16} />
              {inviteStatus === 'sending' ? 'Sending…' : 'Broadcast to chat'}
            </button>
          </div>
          {inviteStatus === 'success' && (
            <p className="status-note status-note--success">Invite posted to public chat.</p>
          )}
          {inviteStatus === 'error' && inviteError && <p className="status-note status-note--error">{inviteError}</p>}
        </div>
      </section>

      <section className="card">
        <header className="card__title">
          <Users size={14} /> Peers
        </header>
        <div className="special-peers">
          <SpecialPeer label="You" peerId={webPeerId ?? extensionPeerId} role="you" />
          <SpecialPeer label="Assistant" peerId={extensionPeerId} role="assistant" />
          <div className="special-peer special-peer--stat">
            <div>
              <p className="special-peer__label">Connections</p>
              <p className="special-peer__id">{connectedCount}</p>
            </div>
            <p className="special-peer__stat">Peers in chat: {subscribedCount}</p>
          </div>
        </div>
        <PeerList peers={peers} />
      </section>
    </>
  )
}

export default function App() {
  return (
    <ExtensionLibp2pProvider>
      <div className="panel">
        <header className="panel__header">
          <div className="brand">
            <div className="brand__badge">M</div>
            <div>
              <p className="brand__label">Metered Extension</p>
              <p className="brand__subhead">P2P side panel</p>
            </div>
          </div>
          <button className="button button--primary" type="button" onClick={() => openInNewTab(DEFAULT_WEB_APP_URL)}>
            <ExternalLink size={16} /> Open web app
          </button>
        </header>
        <main className="panel__main">
          <AppShell />
        </main>
      </div>
    </ExtensionLibp2pProvider>
  )
}
