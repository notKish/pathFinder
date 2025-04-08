// src/content/content.js
import browser from 'webextension-polyfill';
import { generateCssSelector, generateXPath, countElements, findParentElement } from '../utils/selectors'; // Import logic

console.log("Element Inspector Pro: Content script loaded.");

// --- State ---
let isInspecting = false;
let inspectingTarget = null; // 'parent' | 'child'
let currentOverlay = null;
let highlightOverlays = []; // For search highlights
let storedParentSelectors = null; // Store parent selectors when inspecting child

const overlayColor = 'rgba(0, 110, 255, 0.7)';
const highlightBgColor = 'rgba(100, 150, 255, 0.2)';
const searchHighlightColor = 'rgba(255, 165, 0, 0.7)'; // Orange for search
const searchHighlightBg = 'rgba(255, 165, 0, 0.2)';

// --- Overlay Functions ---

function createOverlay(element, color, bgColor, text = null, id = 'inspector-overlay') {
  removeOverlay(id); // Remove specific overlay if exists

  const rect = element.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.position = 'fixed';
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.border = `2px solid ${color}`;
  overlay.style.backgroundColor = bgColor;
  overlay.style.borderRadius = '3px';
  overlay.style.zIndex = '2147483647';
  overlay.style.pointerEvents = 'none';
  overlay.style.boxSizing = 'border-box';
  overlay.dataset.inspectorOverlay = "true"; // Mark element

  if (text) {
    const tagPopup = document.createElement('span');
    tagPopup.textContent = text;
    // ... (popup styling from previous examples) ...
    tagPopup.style.position = 'absolute';
    tagPopup.style.top = '-22px';
    tagPopup.style.left = '0px';
    tagPopup.style.backgroundColor = color;
    tagPopup.style.color = 'white';
    tagPopup.style.padding = '2px 5px';
    tagPopup.style.fontSize = '11px';
    tagPopup.style.borderRadius = '3px';
    tagPopup.style.whiteSpace = 'nowrap';
    overlay.appendChild(tagPopup);
  }

  document.body.appendChild(overlay);
  return overlay;
}

function removeOverlay(id = 'inspector-overlay') {
  const existingOverlay = document.getElementById(id);
  if (existingOverlay) {
    existingOverlay.remove();
  }
  if (id === 'inspector-overlay') {
    currentOverlay = null;
  }
}

function clearSearchHighlights() {
  highlightOverlays.forEach(overlay => overlay.remove());
  highlightOverlays = [];
  // Also clear single validation highlight if present
  removeOverlay('validation-overlay');
}

// --- Event Handlers ---

const handleMouseOver = (event) => {
  if (!isInspecting) return;
  const target = event.target;
  // Ignore overlays themselves
  if (target === currentOverlay || target.dataset?.inspectorOverlay) return;
  currentOverlay = createOverlay(target, overlayColor, highlightBgColor, target.tagName.toLowerCase());
};

const handleClick = (event) => {
  if (!isInspecting || !inspectingTarget) return;
  event.preventDefault();
  event.stopPropagation();

  const clickedElement = event.target;
  console.log(`${inspectingTarget} selected:`, clickedElement);

  let contextElement = document;
  let cssSelector = null;
  let xpathSelector = null;
  let error = null;

  if (inspectingTarget === 'child') {
    const parentElement = findParentElement(storedParentSelectors);
    if (!parentElement) {
      error = "Parent element could not be found on the page.";
      console.error(error);
    } else {
      // Check if clicked element is actually WITHIN the found parent
      if (!parentElement.contains(clickedElement)) {
        error = "Selected element is not inside the defined parent.";
        console.error(error);
      } else {
        contextElement = parentElement; // Generate relative to parent
      }
    }
  }

  if (!error) {
    cssSelector = generateCssSelector(clickedElement, contextElement);
    xpathSelector = generateXPath(clickedElement, contextElement); // Assuming XPath relative logic is simpler
    console.log('Generated CSS:', cssSelector);
    console.log('Generated XPath:', xpathSelector);
  }

  // Count how many elements match the new selector in the appropriate context
  const cssCount = error ? 0 : countElements(cssSelector, 'css', contextElement);
  const xpathCount = error ? 0 : countElements(xpathSelector, 'xpath', document); // XPath usually global

  // Send result back
  browser.runtime.sendMessage({
    action: "elementSelected",
    target: inspectingTarget,
    selectors: { css: cssSelector, xpath: xpathSelector },
    counts: { css: cssCount, xpath: xpathCount },
    tag: clickedElement.tagName.toLowerCase(),
    error: error
  });

  stopInspectionMode();
};

const handleKeyDown = (event) => {
  if (isInspecting && event.key === 'Escape') {
    console.log("Inspection cancelled by Escape key.");
    stopInspectionMode(true); // Pass flag to indicate cancellation
  }
};

// --- Inspection Control ---

function startInspectionMode(target, parentSelectors) {
  if (isInspecting) {
    console.warn("Already inspecting.");
    return; // Or stop previous one?
  }
  console.log(`Starting inspection for ${target}...`);
  isInspecting = true;
  inspectingTarget = target;
  storedParentSelectors = parentSelectors; // Store parent selectors if inspecting child
  clearSearchHighlights(); // Clear any previous search highlights

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  document.body.style.cursor = 'crosshair';
}

function stopInspectionMode(cancelled = false) {
  if (!isInspecting) return;
  console.log("Stopping inspection.");
  const stoppedTarget = inspectingTarget;
  isInspecting = false;
  inspectingTarget = null;
  storedParentSelectors = null;

  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('keydown', handleKeyDown, true);
  removeOverlay(); // Remove the hover overlay
  document.body.style.cursor = 'default';

  if (cancelled && stoppedTarget) {
    browser.runtime.sendMessage({
      action: "inspectionCancelled",
      target: stoppedTarget
    });
  }
}

// --- Search/Validation ---

function searchAndHighlight(selector, type) {
  clearSearchHighlights(); // Clear previous search results
  let count = 0;
  let error = null;
  try {
    if (type === 'css') {
      const elements = document.querySelectorAll(selector);
      count = elements.length;
      elements.forEach((el, index) => {
        const overlay = createOverlay(el, searchHighlightColor, searchHighlightBg, `${index + 1}`, `search-highlight-${index}`);
        highlightOverlays.push(overlay);
      });
    } else if (type === 'xpath') {
      const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      let node = result.iterateNext();
      let index = 0;
      while (node) {
        if (node instanceof Element) {
          const overlay = createOverlay(node, searchHighlightColor, searchHighlightBg, `${index + 1}`, `search-highlight-${index}`);
          highlightOverlays.push(overlay);
          index++;
        }
        node = result.iterateNext();
      }
      count = index;
    }
  } catch (e) {
    console.error(`Error searching for ${type} selector "${selector}":`, e);
    error = e.message;
  }
  // Send results back to popup
  browser.runtime.sendMessage({
    action: "searchResults",
    selector: selector,
    type: type,
    count: count,
    error: error
  });
}


// --- Message Listener ---
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content Script Received:", message);

  switch (message.action) {
    case "startInspection":
      startInspectionMode(message.target, message.parentSelectors);
      // Acknowledge sync
      sendResponse({ status: `Inspection started for ${message.target}` });
      return false; // No async response needed

    case "searchSelector":
      searchAndHighlight(message.selector, message.type);
      return false; // Response sent via separate message

    case "clearHighlights": // Add action to clear search highlights from popup
      clearSearchHighlights();
      return false;

    default:
      console.warn("Unknown message action:", message.action);
      return false; // Indicate message not handled
  }
});

console.log("Element Inspector Pro: Content script ready.");
