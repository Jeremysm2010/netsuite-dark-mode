// Keyboard toggle + toolbar badge, so Alt+Shift+D gives visible feedback.

function paintBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
  chrome.action.setBadgeBackgroundColor({ color: "#5f6368" });
  chrome.action.setTitle({ title: enabled ? "NetSuite Dark Mode — on" : "NetSuite Dark Mode — off" });
}
function refreshBadge() {
  chrome.storage.local.get({ enabled: true }, (s) => paintBadge(s.enabled));
}

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd !== "toggle-dark") return;
  chrome.storage.local.get({ enabled: true }, (s) => chrome.storage.local.set({ enabled: !s.enabled }));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) paintBadge(changes.enabled.newValue !== false);
});

chrome.runtime.onInstalled.addListener(refreshBadge);
chrome.runtime.onStartup.addListener(refreshBadge);
refreshBadge();
