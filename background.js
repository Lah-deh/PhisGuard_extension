let allowedUrlsPerTab = {};
let checkedUrlsPerTab = {};
let originalUrlPerTab = {};

// Normalize URL
function normalizeUrl(url) {
  try {
    let u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

// Shared function to check a URL before loading
async function checkAndHandleNavigation(tabId, frameId, url) {
  if (frameId !== 0) return; // Only main frame
  if (!tabId || tabId < 0) return;

  const currentUrl = normalizeUrl(url);

  // Skip special pages
  if (
    currentUrl.startsWith("chrome://") ||
    currentUrl.startsWith("edge://") ||
    currentUrl.startsWith("about:") ||
    currentUrl.startsWith("file://") ||
    currentUrl.startsWith("chrome-extension://") ||
    currentUrl.includes("blank.html") ||
    currentUrl.includes("warning.html")
  ) {
    return;
  }

  // Skip if allowed or already checked
  if (allowedUrlsPerTab[tabId] === currentUrl) return;
  if (checkedUrlsPerTab[tabId] === currentUrl) return;

  // Save the original target URL
  originalUrlPerTab[tabId] = currentUrl;

  // Show blank page immediately
  chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blank.html") });

  try {
    const response = await fetch("https://phishguard-api-0nyx.onrender.com/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl })
    });

    if (!response.ok) {
      console.warn(`PhishGuard API returned ${response.status}, allowing:`, currentUrl);
      chrome.tabs.update(tabId, { url: currentUrl });
      return;
    }

    const result = await response.json();
    const { prediction, severity, confidence } = result;

    checkedUrlsPerTab[tabId] = currentUrl;

    if (prediction.toLowerCase() === "phishing" && severity.toLowerCase() !== "benign") {
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL(
          `warning.html?url=${encodeURIComponent(currentUrl)}&tabId=${tabId}&severity=${severity}&confidence=${confidence.toFixed(2)}`
        )
      });
    } else {
      chrome.tabs.update(tabId, { url: currentUrl });
    }
  } catch (err) {
    console.warn("PhishGuard API unavailable, allowing:", currentUrl, "Error:", err);
    chrome.tabs.update(tabId, { url: currentUrl });
  }
}

// Listen before navigation (typed URLs)
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  checkAndHandleNavigation(details.tabId, details.frameId, details.url);
});

// Listen after navigation is committed (redirects, external links)
chrome.webNavigation.onCommitted.addListener((details) => {
  checkAndHandleNavigation(details.tabId, details.frameId, details.url);
});

// Handle "Allow Anyway"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "allowUrl" && message.tabId !== undefined && message.url) {
    const normalized = normalizeUrl(message.url);
    allowedUrlsPerTab[message.tabId] = normalized;
    checkedUrlsPerTab[message.tabId] = normalized;
    chrome.tabs.update(message.tabId, { url: normalized });
    sendResponse({ status: "ok" });
  }
});

// Clear data when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  delete allowedUrlsPerTab[tabId];
  delete checkedUrlsPerTab[tabId];
  delete originalUrlPerTab[tabId];
});
