import { useCallback, useEffect, useRef, useState } from 'react'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { createFromPrivKey } from '@libp2p/peer-id-factory'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'

const WEB_STORAGE_KEY = 'uniconnect.web.peer.identity'
const LEGACY_WEB_STORAGE_KEY = 'uniconnect.peer.identity'

const decodePeerId = async (encoded?: string | null): Promise<string | null> => {
  if (!encoded) {
    return null
  }

  try {
    const bytes = uint8ArrayFromString(encoded, 'base64pad')
    const privateKey = await privateKeyFromProtobuf(bytes)
    const peerId = await createFromPrivKey(privateKey as any)

    return peerId.toString()
  } catch {
    return null
  }
}

export type WebPeerSyncResult = 'live' | 'stored' | 'none'

interface WebPeerState {
  peerId: string | null
  online: boolean
  refresh: () => Promise<WebPeerSyncResult>
  syncing: boolean
}

export function useWebPeerId(): WebPeerState {
  const [webPeerId, setWebPeerId] = useState<string | null>(null)
  const [hostOnline, setHostOnline] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const pendingProbe = useRef(false)

  const applyEncodedPeer = useCallback(
    async (encoded?: string | null, opts: { online?: boolean | null } = {}) => {
      const derived = await decodePeerId(encoded)

      setWebPeerId((prev) => {
        if (prev === derived) {
          return prev
        }

        return derived
      })

      if (opts.online === true) {
        setHostOnline(Boolean(derived))
      } else if (opts.online === false) {
        setHostOnline(false)
      }

      return Boolean(derived)
    },
    [],
  )

  const loadFromStorage = useCallback(
    async ({ markOffline = false }: { markOffline?: boolean } = {}) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        if (markOffline) {
          setHostOnline(false)
        }

        return false
      }

      return await new Promise<boolean>((resolve) => {
        chrome.storage.local.get([WEB_STORAGE_KEY], (items) => {
          applyEncodedPeer(items[WEB_STORAGE_KEY] as string | undefined, {
            online: markOffline ? false : undefined,
          })
            .then((hasPeer) => resolve(hasPeer))
            .catch(() => resolve(false))
        })
      })
    },
    [applyEncodedPeer],
  )

  const probeForLiveTab = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return false
    }

    let live = false

    let tabs: chrome.tabs.Tab[]

    try {
      tabs = await chrome.tabs.query({ url: ['http://localhost/*', 'https://*/*'] })
    } catch {
      return false
    }

    for (const tab of tabs) {
      if (!tab.id) continue

      const response = await new Promise<{ encodedKey?: string | null } | undefined>((resolve) => {
        try {
          chrome.tabs.sendMessage(
            tab.id!,
            { type: 'metered:getWebIdentity' },
            (result) => {
              if (chrome.runtime?.lastError) {
                resolve(undefined)

                return
              }

              resolve(result as { encodedKey?: string | null } | undefined)
            },
          )
        } catch {
          resolve(undefined)
        }
      })

      if (response?.encodedKey) {
        const applied = await applyEncodedPeer(response.encodedKey, { online: true })

        if (applied) {
          live = true
          break
        }
      }
    }

    return live
  }, [applyEncodedPeer])

  const refresh = useCallback(async () => {
    if (syncing) {
      return 'none'
    }

    setSyncing(true)

    try {
      const live = await probeForLiveTab()

      if (live) {
        return 'live'
      }

      const stored = await loadFromStorage({ markOffline: true })

      return stored ? 'stored' : 'none'
    } finally {
      setSyncing(false)
    }
  }, [loadFromStorage, probeForLiveTab, syncing])

  useEffect(() => {
    loadFromStorage({ markOffline: true }).catch(() => {})
    probeForLiveTab().catch(() => {})

    const handleStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local') {
        return
      }

      const change = changes[WEB_STORAGE_KEY]

      if (!change) {
        return
      }

      applyEncodedPeer(change.newValue as string | undefined, {
        online: change.newValue ? undefined : false,
      }).catch(() => {})

      if (change.newValue && !pendingProbe.current) {
        pendingProbe.current = true
        probeForLiveTab()
          .catch(() => {})
          .finally(() => {
            pendingProbe.current = false
          })
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange)
    }

    const interval = setInterval(() => {
      probeForLiveTab().catch(() => {})
    }, 20000)

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange)
      }
      clearInterval(interval)
    }
  }, [applyEncodedPeer, loadFromStorage, probeForLiveTab])

  return { peerId: webPeerId, online: hostOnline, refresh, syncing }
}
