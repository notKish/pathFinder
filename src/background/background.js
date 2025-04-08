// src/background/background.js
import browser from 'webextension-polyfill';

console.log("Element Inspector Pro: Background script running.");


// --- Open Side Panel on Action Click ---
browser.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    console.error("Action clicked, but could not get tab ID.");
    return;
  }
  console.log(`Action clicked on tab ${tab.id}. Opening side panel.`);

  try {
    // Toggles the side panel open/closed for the specific tab
    await browser.sidePanel.open({ tabId: tab.id });
    console.log(`Side panel requested for tab ${tab.id}`);
  } catch (error) {
    console.error(`Error opening side panel for tab ${tab.id}:`, error);
    // Handle potential errors (e.g., trying to open on restricted pages)
  }
});


// Optional: Keep side panel context aware (might not be strictly needed)
// This ensures the side panel's content might refresh or adapt if the user
// navigates *within the tab the panel is attached to*.
// The core message sending relies on the tabId obtained when an action occurs.
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // You could potentially check if the side panel is open for this tab
  // and send a message to it if the URL changes significantly, if needed.
  // For this app, direct interaction likely handles context sufficiently.
  // Example check:
  // if (changeInfo.url) {
  //   console.log(`Tab ${tabId} updated URL to ${changeInfo.url}`);
  //   // Query side panel state if necessary
  // }
});


console.log("Element Inspector Pro: Background script ready.");
