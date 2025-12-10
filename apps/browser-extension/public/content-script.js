;(() => {
  const PAGE_STORAGE_KEY = 'uniconnect.peer.identity'
  const PAGE_CHECKSUM_KEY = `${PAGE_STORAGE_KEY}.sha256`
  const SHARED_STORAGE_KEY = 'uniconnect.web.peer.identity'
  const SHARED_CHECKSUM_KEY = `${SHARED_STORAGE_KEY}.sha256`

  const hasChromeStorage = typeof chrome !== 'undefined' && chrome?.storage?.local

  if (!hasChromeStorage) {
    return
  }

  const readPageIdentity = () => {
    try {
      return {
        value: window.localStorage.getItem(PAGE_STORAGE_KEY),
        checksum: window.localStorage.getItem(PAGE_CHECKSUM_KEY),
      }
    } catch (error) {
      return { value: null, checksum: null }
    }
  }

  const writePageIdentity = (value, checksum) => {
    try {
      if (value) {
        window.localStorage.setItem(PAGE_STORAGE_KEY, value)
      } else {
        window.localStorage.removeItem(PAGE_STORAGE_KEY)
      }

      if (checksum) {
        window.localStorage.setItem(PAGE_CHECKSUM_KEY, checksum)
      } else {
        window.localStorage.removeItem(PAGE_CHECKSUM_KEY)
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
      [SHARED_STORAGE_KEY]: value ?? null,
      [SHARED_CHECKSUM_KEY]: checksum ?? null,
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
    chrome.storage.local.get([SHARED_STORAGE_KEY, SHARED_CHECKSUM_KEY], (items) => {
      if (chrome.runtime?.lastError) {
        return
      }

      const storedValue = items[SHARED_STORAGE_KEY] ?? null
      const storedChecksum = items[SHARED_CHECKSUM_KEY] ?? null

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

      if (key === PAGE_STORAGE_KEY || key === PAGE_CHECKSUM_KEY) {
        syncPageToChrome()
      }
    }

    window.localStorage.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem.apply(this, arguments)

      if (key === PAGE_STORAGE_KEY || key === PAGE_CHECKSUM_KEY) {
        syncPageToChrome()
      }
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return
    }

    const identityChange = changes[SHARED_STORAGE_KEY]
    const checksumChange = changes[SHARED_CHECKSUM_KEY]

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'metered:getWebIdentity') {
      return
    }

    sendResponse({
      encodedKey: window.localStorage.getItem(PAGE_STORAGE_KEY),
      checksum: window.localStorage.getItem(PAGE_CHECKSUM_KEY),
    })

    return true
  })
})()
