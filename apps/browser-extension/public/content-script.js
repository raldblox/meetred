;(() => {
  const STORAGE_KEY = 'uniconnect.peer.identity'
  const CHECKSUM_KEY = `${STORAGE_KEY}.sha256`

  const hasChromeStorage = typeof chrome !== 'undefined' && chrome?.storage?.local

  if (!hasChromeStorage) {
    return
  }

  const readPageIdentity = () => {
    try {
      return {
        value: window.localStorage.getItem(STORAGE_KEY),
        checksum: window.localStorage.getItem(CHECKSUM_KEY),
      }
    } catch (error) {
      return { value: null, checksum: null }
    }
  }

  const writePageIdentity = (value, checksum) => {
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
    } catch (error) {
      // ignore storage failures
    }
  }

  let applyingFromChrome = false

  const syncPageToChrome = () => {
    if (!hasChromeStorage || applyingFromChrome) {
      return
    }

    const { value, checksum } = readPageIdentity()

    chrome.storage.local.set({
      [STORAGE_KEY]: value ?? null,
      [CHECKSUM_KEY]: checksum ?? null,
    })
  }

  const applyChromeToPage = (value, checksum) => {
    const current = readPageIdentity()

    if (current.value === value && current.checksum === checksum) {
      return
    }

    applyingFromChrome = true
    writePageIdentity(value, checksum)
    applyingFromChrome = false
  }

  const hydrateFromChrome = () => {
    chrome.storage.local.get([STORAGE_KEY, CHECKSUM_KEY], (items) => {
      if (chrome.runtime?.lastError) {
        return
      }

      const storedValue = items[STORAGE_KEY] ?? null
      const storedChecksum = items[CHECKSUM_KEY] ?? null

      if (storedValue) {
        applyChromeToPage(storedValue, storedChecksum)
      } else {
        syncPageToChrome()
      }
    })
  }

  const patchStorage = () => {
    const originalSetItem = window.localStorage.setItem
    const originalRemoveItem = window.localStorage.removeItem

    window.localStorage.setItem = function patchedSetItem(key, value) {
      originalSetItem.apply(this, arguments)

      if (key === STORAGE_KEY || key === CHECKSUM_KEY) {
        syncPageToChrome()
      }
    }

    window.localStorage.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem.apply(this, arguments)

      if (key === STORAGE_KEY || key === CHECKSUM_KEY) {
        syncPageToChrome()
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return
    }

    const identityChange = changes[STORAGE_KEY]
    const checksumChange = changes[CHECKSUM_KEY]

    if (!identityChange && !checksumChange) {
      return
    }

    const nextValue = identityChange ? identityChange.newValue ?? null : readPageIdentity().value
    const nextChecksum = checksumChange ? checksumChange.newValue ?? null : readPageIdentity().checksum

    applyChromeToPage(nextValue, nextChecksum)
  })

  patchStorage()
  hydrateFromChrome()
  syncPageToChrome()
})()
