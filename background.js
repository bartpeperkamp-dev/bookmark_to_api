let currentTab;

// Set just before the outgoing fetch() below and read by the
// webRequest listener, since fetch() itself cannot set Origin
// (it's a forbidden header per the Fetch spec).
let pendingOriginOverride = null;

/*
 * POSTs the current tab's URL to the configured settings URL,
 * authenticated with the configured bearer token, with the Origin
 * header set to the settings URL's own origin.
 */
function sendUrl() {
  if (!currentTab) {
    return;
  }
  browser.storage.local.get(["url", "token"]).then((settings) => {
    if (!settings.url) {
      return;
    }
    pendingOriginOverride = { url: settings.url, origin: new URL(settings.url).origin };
    fetch(settings.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${settings.token || ""}`
      },
      body: JSON.stringify({ url: currentTab.url })
    }).catch((error) => {
      console.error("Send bookmark to API: failed to notify configured URL:", error);
    }).finally(() => {
      pendingOriginOverride = null;
    });
  });
}

/*
 * Rewrites the Origin header on the outgoing POST above to the
 * configured value, when one is set.
 */
browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!pendingOriginOverride || details.url !== pendingOriginOverride.url) {
      return {};
    }
    let requestHeaders = details.requestHeaders.filter((header) => header.name.toLowerCase() !== "origin");
    requestHeaders.push({ name: "Origin", value: pendingOriginOverride.origin });
    return { requestHeaders };
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["blocking", "requestHeaders"]
);

browser.browserAction.onClicked.addListener(sendUrl);

/*
 * Right-click menu on the toolbar button to open the settings page.
 */
browser.menus.create({
  id: "open-settings",
  title: "Settings",
  contexts: ["browser_action"]
});

browser.menus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-settings") {
    browser.runtime.openOptionsPage();
  }
});

/*
 * Keeps currentTab in sync with the currently active tab.
 */
function updateAddonStateForActiveTab(tabs) {
  function updateTab(tabs) {
    if (tabs[0]) {
      currentTab = tabs[0];
    }
  }

  let gettingActiveTab = browser.tabs.query({active: true, currentWindow: true});
  gettingActiveTab.then(updateTab);
}

// listen to tab URL changes
browser.tabs.onUpdated.addListener(updateAddonStateForActiveTab);

// listen to tab switching
browser.tabs.onActivated.addListener(updateAddonStateForActiveTab);

// listen for window switching
browser.windows.onFocusChanged.addListener(updateAddonStateForActiveTab);

// update when the extension loads initially
updateAddonStateForActiveTab();
