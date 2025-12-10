import { useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import clsx from "clsx";

import "./App.css";

import { ExtensionLibp2pProvider, useExtensionLibp2p } from "./context/libp2p";
import { usePeerPresence } from "./hooks/usePeerPresence";
import { PeerList } from "./components/PeerList";
import { CHAT_TOPIC } from "@/config/constants";
import { exportStoredPrivateKey, importPrivateKey } from "@/lib/identity";

const DEFAULT_WEB_APP_URL =
  (import.meta.env.VITE_WEB_APP_URL as string | undefined) ??
  "https://meetred.vercel.app";

const openInNewTab = (url: string) => window.open(url, "_blank", "noreferrer");

function AppShell() {
  const { libp2p, status, error, restart, rotateIdentity, rotatingIdentity } =
    useExtensionLibp2p();
  const { peers, connectedCount, subscribedCount } = usePeerPresence(libp2p);

  const peerId = libp2p?.peerId.toString() ?? "";
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [linkStatus, setLinkStatus] = useState<"idle" | "copied">("idle");
  const [keyCopyStatus, setKeyCopyStatus] = useState<
    "idle" | "copied" | "error"
  >("idle");
  const [inviteStatus, setInviteStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showImportField, setShowImportField] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [importing, setImporting] = useState(false);
  const [identityImportState, setIdentityImportState] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [identityImportError, setIdentityImportError] = useState<string | null>(
    null
  );

  const streamLink = useMemo(() => {
    if (!peerId) {
      return DEFAULT_WEB_APP_URL;
    }

    try {
      const url = new URL(DEFAULT_WEB_APP_URL);
      url.pathname = `/stream/${peerId}`;
      url.search = "";
      url.hash = "";

      return url.toString();
    } catch {
      return `${DEFAULT_WEB_APP_URL.replace(/\/$/, "")}/stream/${peerId}`;
    }
  }, [peerId]);

  const copyToClipboard = async (value: string, bucket: "id" | "stream") => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      if (bucket === "id") {
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
      } else {
        setLinkStatus("copied");
        setTimeout(() => setLinkStatus("idle"), 2000);
      }
    } catch {
      // ignore clipboard failures silently; user can manually copy
    }
  };

  const handleSendStreamInvite = async () => {
    if (!libp2p) {
      return;
    }

    setInviteStatus("sending");
    setInviteError(null);

    try {
      const payload = JSON.stringify({
        type: "stream_invite",
        streamId: peerId,
        hostPeerId: peerId,
        createdAt: Date.now(),
      });

      await libp2p.services.pubsub.publish(
        CHAT_TOPIC,
        new TextEncoder().encode(payload)
      );
      setInviteStatus("success");
      setTimeout(() => setInviteStatus("idle"), 2200);
    } catch (err: any) {
      setInviteStatus("error");
      setInviteError(err?.message ?? "Failed to send invite");
    }
  };

  const handleCopyIdentityKey = async () => {
    const key = exportStoredPrivateKey();

    if (!key) {
      setKeyCopyStatus("error");
      setTimeout(() => setKeyCopyStatus("idle"), 2200);

      return;
    }

    try {
      await navigator.clipboard.writeText(key);
      setKeyCopyStatus("copied");
      setTimeout(() => setKeyCopyStatus("idle"), 2200);
    } catch {
      setKeyCopyStatus("error");
      setTimeout(() => setKeyCopyStatus("idle"), 2200);
    }
  };

  const toggleImportField = () => {
    setShowImportField((prev) => !prev);
    setImportValue("");
    setImporting(false);
    setIdentityImportState("idle");
    setIdentityImportError(null);
  };

  const handleImportIdentity = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = importValue.trim();

    if (!value) {
      setIdentityImportError("Private key value cannot be empty");
      setIdentityImportState("error");

      return;
    }

    setImporting(true);
    setIdentityImportError(null);
    setIdentityImportState("idle");

    try {
      await importPrivateKey(value);
      await restart(undefined, { skipChromePrefetch: true });
      setShowImportField(false);
      setImportValue("");
      setIdentityImportState("success");
    } catch (err: any) {
      setIdentityImportState("error");
      setIdentityImportError(err?.message ?? "Failed to import identity");
    } finally {
      setImporting(false);
    }
  };

  if (status === "booting") {
    return (
      <div className="card loading-card">
        <Loader2 className="spinner" size={20} />
        <p>Connecting to the Metered P2P network…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card error-card">
        <p>We could not start the P2P node.</p>
        {error && <pre className="error-card__details">{error}</pre>}
        <button
          className="button button--primary"
          type="button"
          onClick={() => restart()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="card">
        <header className="card__title">Identity</header>
        <div className="card__body">
          <div>
            <p className="helper-text">Your peer ID</p>
            <div className="mono-field">
              <span>{peerId || "Loading…"}</span>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => copyToClipboard(peerId, "id")}
              >
                <Copy size={16} /> {copyStatus === "copied" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="actions">
            <button
              className={clsx("button", "button--ghost")}
              disabled={rotatingIdentity}
              type="button"
              onClick={rotateIdentity}
            >
              <RefreshCw
                className={clsx({ spinning: rotatingIdentity })}
                size={16}
              />
              {rotatingIdentity ? "Resetting…" : "Rotate identity"}
            </button>
            <button
              className="button button--subtle"
              type="button"
              onClick={() => openInNewTab(DEFAULT_WEB_APP_URL)}
            >
              <ExternalLink size={16} /> Open full app
            </button>
          </div>
          <div className="actions">
            <button
              className="button button--ghost"
              type="button"
              onClick={handleCopyIdentityKey}
            >
              <Copy size={16} />{" "}
              {keyCopyStatus === "copied" ? "Key copied" : "Copy identity key"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={toggleImportField}
            >
              {showImportField ? "Hide import" : "Restore identity"}
            </button>
          </div>
          {keyCopyStatus === "error" && (
            <p className="status-note status-note--error">
              No stored identity yet.
            </p>
          )}
          {keyCopyStatus === "copied" && (
            <p className="status-note status-note--success">
              Identity key copied to clipboard.
            </p>
          )}
          {identityImportState === "success" && !showImportField && (
            <p className="status-note status-note--success">
              Identity imported. Node restarted.
            </p>
          )}
          {showImportField && (
            <form className="import-card" onSubmit={handleImportIdentity}>
              <label className="helper-text" htmlFor="identity-input">
                Paste a backup key
              </label>
              <textarea
                id="identity-input"
                placeholder="Base64 or hex encoded private key"
                value={importValue}
                onChange={(event) => setImportValue(event.target.value)}
              />
              <div className="actions">
                <button
                  className="button button--primary"
                  disabled={importing}
                  type="submit"
                >
                  {importing ? "Importing…" : "Import identity"}
                </button>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={toggleImportField}
                >
                  Cancel
                </button>
              </div>
              {identityImportError && (
                <p className="status-note status-note--error">
                  {identityImportError}
                </p>
              )}
            </form>
          )}
        </div>
        <div className="stats-grid">
          <div className="stat">
            <p className="stat__label">Direct connections</p>
            <p className="stat__value">{connectedCount}</p>
          </div>
          <div className="stat">
            <p className="stat__label">Peers in chat</p>
            <p className="stat__value">{subscribedCount}</p>
          </div>
          <div className="stat">
            <p className="stat__label">Total discovered</p>
            <p className="stat__value">{peers.length}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card__title">Stream tools</header>
        <div className="card__body">
          <div>
            <p className="helper-text">Stream room link</p>
            <div className="mono-field">
              <span>{streamLink}</span>
              <button
                className="button button--ghost"
                type="button"
                onClick={() => copyToClipboard(streamLink, "stream")}
              >
                <Copy size={16} /> {linkStatus === "copied" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="actions">
            <button
              className="button button--primary"
              type="button"
              onClick={() => openInNewTab(streamLink)}
            >
              <ExternalLink size={16} /> Open stream lobby
            </button>
            <button
              className="button button--ghost"
              disabled={inviteStatus === "sending"}
              type="button"
              onClick={handleSendStreamInvite}
            >
              <Send size={16} />
              {inviteStatus === "sending" ? "Sending…" : "Broadcast to chat"}
            </button>
          </div>
          {inviteStatus === "success" && (
            <p className="status-note status-note--success">
              Invite posted to public chat.
            </p>
          )}
          {inviteStatus === "error" && inviteError && (
            <p className="status-note status-note--error">{inviteError}</p>
          )}
        </div>
      </section>

      <section className="card">
        <header className="card__title">
          <Users size={14} /> Online peers
        </header>
        <PeerList peers={peers} />
      </section>
    </>
  );
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
          <button
            className="button button--primary"
            type="button"
            onClick={() => openInNewTab(DEFAULT_WEB_APP_URL)}
          >
            <ExternalLink size={16} /> Open web app
          </button>
        </header>
        <main className="panel__main">
          <AppShell />
        </main>
      </div>
    </ExtensionLibp2pProvider>
  );
}
