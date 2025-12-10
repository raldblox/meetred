chrome.runtime.onInstalled.addListener(() => {
  if (!chrome.sidePanel?.setPanelBehavior) {
    return
  }

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // ignore initialization errors (older chrome versions)
  })
})

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !chrome.sidePanel?.open) {
    return
  }

  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {
    // swallow errors so the background worker stays alive
  })
})
