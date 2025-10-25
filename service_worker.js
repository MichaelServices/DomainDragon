// service_worker.js
const DEFAULT_BLOCKLIST = [
  // Example patterns (hosts or simple substrings). Edit in Options.
  "example-bad-site.com",
  "malicious-example",
  "phishing-site"
];

// Normalize and load storage on startup
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(["blocklist"]);
  if (!data.blocklist) await chrome.storage.local.set({ blocklist: DEFAULT_BLOCKLIST });
});

// Helper to load blocklist (returns array of patterns)
async function getBlocklist() {
  const data = await chrome.storage.local.get(["blocklist"]);
  return Array.isArray(data.blocklist) ? data.blocklist : [];
}

// Check URL against patterns (simple substring and host matching)
function matchesPattern(url, pattern) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const full = url.toLowerCase();
    const p = pattern.toLowerCase().trim();
    if (!p) return false;
    if (p.startsWith("*.") || p.startsWith(".")) {
      // host suffix match
      const suffix = p.replace(/^\*\./, "").replace(/^\./, "");
      if (host === suffix || host.endsWith("." + suffix)) return true;
    }
    // plain host exact match
    if (host === p) return true;
    // substring anywhere (path, query, host)
    if (full.includes(p)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// When a navigation is committed (top frame), check and redirect to warning page
chrome.webNavigation.onCommitted.addListener(async (details) => {
  try {
    if (details.frameId !== 0) return; // ignore subframes
    const url = details.url || "";
    if (!url.startsWith("http://") && !url.startsWith("https://")) return;

    const blocklist = await getBlocklist();
    for (const pattern of blocklist) {
      if (matchesPattern(url, pattern)) {
        // Redirect the tab to the extension's blocked page, passing original url (encoded)
        const tabId = details.tabId;
        const blockUrl = chrome.runtime.getURL("blocked.html") + "?orig=" + encodeURIComponent(url);
        // Use chrome.tabs.update to navigate the tab to the block page
        chrome.tabs.update(tabId, { url: blockUrl });
        return;
      }
    }
  } catch (err) {
    console.error("Blocker error:", err);
  }
});
