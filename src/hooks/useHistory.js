// src/hooks/useHistory.js
import { useState, useEffect, useCallback } from 'react';
import browser from 'webextension-polyfill';

const STORAGE_KEY = 'elementInspectorHistory';
const MAX_HISTORY_SIZE = 10;

export function useHistory() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load history from storage on initial mount
  useEffect(() => {
    setIsLoading(true);
    browser.storage.local.get(STORAGE_KEY)
      .then(result => {
        if (result[STORAGE_KEY] && Array.isArray(result[STORAGE_KEY])) {
          setHistory(result[STORAGE_KEY]);
        } else {
          setHistory([]); // Initialize if not found or invalid
        }
      })
      .catch(error => {
        console.error("Error loading history from storage:", error);
        setHistory([]); // Default to empty on error
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Save history to storage whenever it changes
  useEffect(() => {
    if (!isLoading) { // Only save after initial load
      browser.storage.local.set({ [STORAGE_KEY]: history })
        .catch(error => {
          console.error("Error saving history to storage:", error);
        });
    }
  }, [history, isLoading]);

  // Function to add an item to history (LRU logic)
  const addHistoryItem = useCallback((item) => { // item = { type, value, count, timestamp }
    setHistory(prevHistory => {
      // Check if item already exists (optional: update timestamp if exists?)
      const existingIndex = prevHistory.findIndex(h => h.type === item.type && h.value === item.value);
      let newHistory = [...prevHistory];

      if (existingIndex > -1) {
        // Remove existing item to move it to the top (most recent)
        newHistory.splice(existingIndex, 1);
      }

      // Add new item to the beginning (most recent)
      newHistory.unshift(item);

      // Enforce max size (remove least recent - from the end)
      if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory = newHistory.slice(0, MAX_HISTORY_SIZE);
      }

      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    browser.storage.local.remove(STORAGE_KEY).catch(e => console.error("Error clearing history:", e));
  }, []);


  return { history, isLoadingHistory: isLoading, addHistoryItem, clearHistory };
}
