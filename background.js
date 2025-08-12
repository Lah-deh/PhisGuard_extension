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

// Runs before navigation actually starts
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // Only main frame
  if (!details.tabId || details.tabId < 0) return;

  const currentUrl = normalizeUrl(details.url);

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

  // If allowed already, skip
  if (allowedUrlsPerTab[details.tabId] === currentUrl) return;

  // If already checked in this tab, skip
  if (checkedUrlsPerTab[details.tabId] === currentUrl) return;

  // Save the original target URL
  originalUrlPerTab[details.tabId] = currentUrl;

  // Immediately show a blank page
  chrome.tabs.update(details.tabId, {
    url: chrome.runtime.getURL("blank.html")
  });

  try {
    const response = await fetch("https://phishguard-api-0nyx.onrender.com/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl })
    });

    if (!response.ok) {
      console.warn(`PhishGuard API returned ${response.status}, allowing:`, currentUrl);
      chrome.tabs.update(details.tabId, { url: currentUrl });
      return;
    }

    const result = await response.json();
    const { prediction, severity, confidence } = result;

    checkedUrlsPerTab[details.tabId] = currentUrl;

    if (prediction.toLowerCase() === "phishing" && severity.toLowerCase() !== "benign") {
      chrome.tabs.update(details.tabId, {
        url: chrome.runtime.getURL(
          `warning.html?url=${encodeURIComponent(currentUrl)}&tabId=${details.tabId}&severity=${severity}&confidence=${confidence.toFixed(2)}`
        )
      });
    } else {
      chrome.tabs.update(details.tabId, { url: currentUrl });
    }
  } catch (err) {
    console.warn("PhishGuard API unavailable, allowing:", currentUrl, "Error:", err);
    chrome.tabs.update(details.tabId, { url: currentUrl });
  }
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
