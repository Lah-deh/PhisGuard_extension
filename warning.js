// warning.js
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const siteUrl = params.get('url') || '';
  const tabId = parseInt(params.get('tabId'), 10);
  const severity = params.get('severity') || '';
  const confidence = params.get('confidence') || '';

  // Fill in details
  document.getElementById('site-url').textContent = siteUrl;
  document.getElementById('threat-level').textContent = severity;
  document.getElementById('confidence-level').textContent = confidence;

  // Set color class for severity
  const threatEl = document.getElementById('threat-level');
  if (severity.toLowerCase() === 'high') threatEl.classList.add('high');
  if (severity.toLowerCase() === 'medium') threatEl.classList.add('medium');
  if (severity.toLowerCase() === 'low') threatEl.classList.add('low');

  // Visit Anyway button
  document.getElementById('proceed-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage(
      { action: 'allowUrl', tabId: tabId, url: siteUrl },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending allowUrl:', chrome.runtime.lastError);
          return;
        }
        if (response && response.status === 'ok') {
          chrome.tabs.update(tabId, { url: siteUrl });
        }
      }
    );
  });

  // Close Tab button
  document.getElementById('close-btn').addEventListener('click', () => {
    chrome.tabs.remove(tabId);
  });
});
