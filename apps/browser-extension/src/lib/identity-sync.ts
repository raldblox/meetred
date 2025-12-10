const STORAGE_KEY = 'uniconnect.peer.identity'
const CHECKSUM_KEY = `${STORAGE_KEY}.sha256`

type ChromeIdentityData = {
  value?: string | null
  checksum?: string | null
}

const hasChromeStorage = (): boolean => typeof chrome !== 'undefined' && !!chrome.storage?.local

const chromeStorageGet = async (): Promise<ChromeIdentityData> => {
  if (!hasChromeStorage()) {
    return {}
  }

  return await new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY, CHECKSUM_KEY], (items) => {
      if (chrome.runtime?.lastError) {
        resolve({})

        return
      }

      resolve({
        value: items[STORAGE_KEY],
        checksum: items[CHECKSUM_KEY],
      })
    })
  })
}

const chromeStorageSet = async (value: string | null, checksum: string | null): Promise<void> => {
  if (!hasChromeStorage()) {
    return
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEY]: value,
        [CHECKSUM_KEY]: checksum,
      },
      () => {
        resolve()
      },
    )
  })
}

const syncToLocalStorage = (value?: string | null, checksum?: string | null): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  const currentValue = window.localStorage.getItem(STORAGE_KEY)
  const currentChecksum = window.localStorage.getItem(CHECKSUM_KEY)

  if (value === currentValue && (checksum ?? null) === (currentChecksum ?? null)) {
    return false
  }

  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }

    if (checksum) {
      window.localStorage.setItem(CHECKSUM_KEY, checksum)
    } else {
      window.localStorage.removeItem(CHECKSUM_KEY)
    }
  } catch {
    return false
  }

  return true
}

let lastPushedIdentity: string | null | undefined

export async function mirrorIdentityFromChromeStorage(): Promise<boolean> {
  if (!hasChromeStorage()) {
    return false
  }

  const { value, checksum } = await chromeStorageGet()

  if (!value) {
    return false
  }

  const changed = syncToLocalStorage(value, checksum ?? null)

  if (changed) {
    lastPushedIdentity = value
  }

  return changed
}

export async function mirrorIdentityToChromeStorage(): Promise<void> {
  if (!hasChromeStorage()) {
    return
  }

  const value = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  const checksum =
    typeof window !== 'undefined' && value ? window.localStorage.getItem(CHECKSUM_KEY) ?? null : null

  lastPushedIdentity = value

  await chromeStorageSet(value, checksum)
}

export function subscribeToChromeIdentityChanges(handler: (changed: boolean) => void): () => void {
  if (!hasChromeStorage()) {
    return () => {}
  }

  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'local') {
      return
    }

    const encodedChange = changes[STORAGE_KEY]
    const checksumChange = changes[CHECKSUM_KEY]

    if (!encodedChange && !checksumChange) {
      return
    }

    const newValue = encodedChange ? (encodedChange.newValue as string | null) : window.localStorage.getItem(STORAGE_KEY)
    const newChecksum = checksumChange
      ? (checksumChange.newValue as string | null)
      : window.localStorage.getItem(CHECKSUM_KEY)

    if (newValue === lastPushedIdentity) {
      return
    }

    const changed = syncToLocalStorage(newValue ?? null, newChecksum ?? null)

    if (changed) {
      handler(true)
    }
  }

  chrome.storage.onChanged.addListener(listener)

  return () => {
    chrome.storage.onChanged.removeListener(listener)
  }
}
