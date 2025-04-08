import React, { useState, useEffect, useCallback } from 'react';
import browser from 'webextension-polyfill';
import InspectorPanel from '../components/InspectorPanel';
import SearchPanel from '../components/SearchPanel';
import HistoryPanel from '../components/HistoryPanel';
import { useHistory } from '../hooks/useHistory'; // Import the custom hook

function App() {
  // State for inspected elements
  const [parentState, setParentState] = useState({ selectors: null, counts: null, error: null });
  const [childState, setChildState] = useState({ selectors: null, counts: null, error: null });

  // State for active inspection
  const [inspectingTarget, setInspectingTarget] = useState(null); // 'parent' | 'child' | null

  // State for search results
  const [searchResults, setSearchResults] = useState({
    css: null, // { count: number, error: string|null }
    xpath: null
  });

  // History state and functions from custom hook
  const { history, isLoadingHistory, addHistoryItem, clearHistory } = useHistory();

  // --- Communication with Content Script ---

  const sendMessageToContentScript = useCallback(async (message) => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        throw new Error("Could not find active tab.");
      }
      // Ensure script is injected (safe to call multiple times)
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js'],
        });
        console.log("content/content.js injected.");
      } catch (injectionError) {
        console.error("Injection Error:", injectionError);
        // Attempt to send message anyway, might already be injected
        // Or show specific error about injection failure
        if (injectionError.message.includes("Cannot access") || injectionError.message.includes("Missing host permission")) {
          alert("Cannot access this page to inspect elements. Check extension permissions or page restrictions.");
          return; // Stop if cannot inject
        }
      }

      return await browser.tabs.sendMessage(tab.id, message);
    } catch (error) {
      console.error("Error sending message to content script:", error);
      // Handle specific errors like no receiver
      if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
        alert("Could not connect to the page. Please reload the page and try again.");
      } else {
        alert(`Communication error: ${error.message}`);
      }
      setInspectingTarget(null); // Stop inspection on comms error
      throw error; // Re-throw for calling function if needed
    }
  }, []);

  // --- Event Handlers ---

  const handleInspect = useCallback((target) => { // target: 'parent' or 'child'
    if (inspectingTarget) return; // Prevent starting new inspection if one is active

    if (target === 'child' && !parentState.selectors?.css && !parentState.selectors?.xpath) {
      alert("Please inspect the Parent element first before inspecting a Child.");
      return;
    }

    console.log(`Requesting inspection for: ${target}`);
    setInspectingTarget(target);
    // Clear previous errors for the target being inspected
    if (target === 'parent') setParentState(s => ({ ...s, error: null }));
    else setChildState(s => ({ ...s, error: null }));

    sendMessageToContentScript({
      action: "startInspection",
      target: target,
      parentSelectors: target === 'child' ? parentState.selectors : null
    })
      .then(response => {
        console.log("Inspection start acknowledged:", response);
        // Button state is handled by inspectingTarget state
      })
      .catch(error => {
        console.error("Failed to start inspection:", error);
        setInspectingTarget(null); // Reset state on failure
      });
  }, [sendMessageToContentScript, inspectingTarget, parentState.selectors]);


  const handleSearch = useCallback((type, selector) => {
    console.log(`Requesting search for ${type}: ${selector}`);
    setSearchResults(prev => ({ ...prev, [type]: { count: null, error: null } })); // Indicate loading/searching
    sendMessageToContentScript({
      action: "searchSelector",
      type: type,
      selector: selector
    }).catch(error => {
      console.error("Failed to send search request:", error);
      setSearchResults(prev => ({ ...prev, [type]: { count: null, error: "Search failed" } }));
    });
  }, [sendMessageToContentScript]);

  const handleClearHighlights = useCallback(() => {
    console.log("Requesting clear highlights");
    sendMessageToContentScript({ action: "clearHighlights" }).catch(error => {
      console.error("Failed to send clear highlights request:", error);
    });
    // Also clear search results state in popup
    setSearchResults({ css: null, xpath: null });
  }, [sendMessageToContentScript]);


  const handleCopy = useCallback((text) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => console.log('Path copied to clipboard:', text))
      .catch(err => console.error('Failed to copy text:', err));
  }, []);

  // --- Effect for Message Listening ---

  useEffect(() => {
    const messageListener = (message, sender) => {
      console.log("Popup received message:", message);

      switch (message.action) {
        case "elementSelected":
          const { target, selectors, counts, tag, error } = message;
          const newState = { selectors, counts, error };
          if (target === 'parent') {
            setParentState(newState);
            // Clear child if parent changes? Optional based on desired UX
            // setChildState({ selectors: null, counts: null, error: null });
          } else if (target === 'child') {
            setChildState(newState);
          }
          setInspectingTarget(null); // Inspection finished
          break;

        case "searchResults":
          const { type, selector, count, error: searchError } = message;
          setSearchResults(prev => ({
            ...prev,
            [type]: { count, error: searchError }
          }));
          // Add successful searches to history
          if (!searchError && count > 0) {
            addHistoryItem({ type, value: selector, count, timestamp: Date.now() });
          }
          break;

        case "inspectionCancelled":
          console.log(`Inspection cancelled for ${message.target}`);
          setInspectingTarget(null); // Reset inspection state
          break;

        default:
          console.warn("Popup received unknown message action:", message.action);
      }
    };

    browser.runtime.onMessage.addListener(messageListener);

    // Cleanup listener on unmount
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, [addHistoryItem]); // Include addHistoryItem dependency

  return (
    <div>
      <div className="panel-container">
        <InspectorPanel
          title="Parent Element"
          targetId="parent"
          selectors={parentState.selectors}
          counts={parentState.counts}
          error={parentState.error}
          isInspecting={inspectingTarget === 'parent'}
          onInspect={handleInspect}
          onCopy={handleCopy}
        />
        <InspectorPanel
          title="Nested Child Element"
          targetId="child"
          selectors={childState.selectors}
          counts={childState.counts}
          error={childState.error}
          isInspecting={inspectingTarget === 'child'}
          onInspect={handleInspect}
          onCopy={handleCopy}
        />
      </div>

      <SearchPanel
        onSearch={handleSearch}
        searchResults={searchResults}
        onClearHighlights={handleClearHighlights}
      />

      <HistoryPanel
        history={history}
        isLoading={isLoadingHistory}
        onCopy={handleCopy}
        onClear={clearHistory}
      />

    </div>
  );
}

export default App;
