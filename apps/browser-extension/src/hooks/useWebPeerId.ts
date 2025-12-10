import { useCallback, useEffect, useState } from 'react'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { createFromPrivKey } from '@libp2p/peer-id-factory'
import { privateKeyFromProtobuf } from '@libp2p/crypto/keys'

const WEB_STORAGE_KEY = 'uniconnect.peer.identity'

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

interface WebPeerState {
  peerId: string | null
  refresh: () => Promise<boolean>
  syncing: boolean
}

export function useWebPeerId(): WebPeerState {
  const [webPeerId, setWebPeerId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const updateFromEncoded = useCallback(async (encoded?: string | null) => {
    const derived = await decodePeerId(encoded)

    setWebPeerId((prev) => {
      if (prev === derived) {
        return prev
      }

      return derived
    })
  }, [])

  const readFromStorage = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return
    }

    chrome.storage.local.get([WEB_STORAGE_KEY], (items) => {
      updateFromEncoded(items[WEB_STORAGE_KEY] as string | undefined).catch(() => {})
    })
  }, [updateFromEncoded])

  const refreshFromTabs = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return false
    }

    setSyncing(true)

    let synced = false

    try {
      const tabs = await chrome.tabs.query({ url: ['http://localhost/*', 'https://*/*'] })

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
          await updateFromEncoded(response.encodedKey)
          synced = true

          break
        }
      }

      if (!synced) {
        readFromStorage()
      }
    } finally {
      setSyncing(false)
    }

    return synced
  }, [readFromStorage, updateFromEncoded])

  useEffect(() => {
    let cancelled = false

    readFromStorage()
    refreshFromTabs().catch(() => {})

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== 'local') {
        return
      }

      const change = changes[WEB_STORAGE_KEY]

      if (!change) {
        return
      }

      updateFromEncoded(change.newValue as string | undefined).catch(() => {})
    }

    chrome.storage.onChanged.addListener(listener)

    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [readFromStorage, refreshFromTabs, updateFromEncoded])

  const refresh = useCallback(async () => {
    if (syncing) {
      return false
    }

    const result = await refreshFromTabs()

    if (!result) {
      readFromStorage()
    }

    return result
  }, [readFromStorage, refreshFromTabs, syncing])

  return { peerId: webPeerId, refresh, syncing }
}
