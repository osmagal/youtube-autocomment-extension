// Service worker for YouTube Auto Commenter Chrome Extension

// Configure side panel to open on extension icon click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn("Could not set side panel behavior:", err);
    });
  }

  // Set default settings in storage if not present
  chrome.storage.local.get(['autoCommentEnabled', 'commentText', 'autoSubmit', 'commentedVideos'], (data) => {
    const defaults = {};
    if (data.autoCommentEnabled === undefined) defaults.autoCommentEnabled = true;
    if (data.commentText === undefined) defaults.commentText = "Ótimo vídeo! Obrigado por compartilhar.";
    if (data.autoSubmit === undefined) defaults.autoSubmit = true;
    if (data.commentedVideos === undefined) defaults.commentedVideos = {};

    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

// Relay messages between sidepanel and content scripts if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_STATUS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CHECK_STATUS' }, (response) => {
          sendResponse(response || { isYouTubeWatch: true, status: 'unknown' });
        });
      } else {
        sendResponse({ isYouTubeWatch: false, status: 'not_watch_page' });
      }
    });
    return true; // async response
  }
});
