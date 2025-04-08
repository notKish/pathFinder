// src/utils/selectors.js

/**
 * Checks if a CSS selector uniquely identifies the target element within a given scope.
 */
function isUniqueSelector(selector, target, scope) {
  try {
    const elements = scope.querySelectorAll(selector);
    return elements.length === 1 && elements[0] === target;
  } catch (e) {
    console.warn(`isUniqueSelector error with selector "${selector}":`, e);
    return false;
  }
}

/**
 * List of RegEx patterns to identify classes to filter out.
 * These often include framework-generated classes, utility classes, or state classes
 * that might not be stable or suitable for selection. Adjust as needed.
 */
const CLASS_FILTER_PATTERNS = [
  /^jsx-\d+$/,                     // React JSX runtime style tags
  /^(?:hover|focus|active|visited|disabled|focus-within|focus-visible)[:_]/, // Pseudo-state prefixes (often dynamically added)
  /^(?:xs|sm|md|lg|xl|2xl)[:_]/,    // Responsive prefixes (e.g., Tailwind)
  /^(?:dark|light)[:_]/,           // Theme prefixes (e.g., Tailwind)
  /^(?:motion-safe|motion-reduce)[:_]/, // Motion preference prefixes (e.g., Tailwind)
  /^(?:aria-.*)/,                  // ARIA state attributes sometimes mirrored as classes
  // Common utility pattern prefixes (Tailwind-like) - add more as needed
  /^(?:p|px|py|pt|pb|pl|pr)-\d+/,  // Padding
  /^(?:m|mx|my|mt|mb|ml|mr)-[-\w]+/, // Margin (can be negative or auto)
  /^(?:w|h)-[-\w]+/,              // Width/Height
  /^(?:min-w|min-h|max-w|max-h)-[-\w]+/, // Min/Max Width/Height
  /^(?:border|rounded|shadow|outline|ring)-[-\w]*/, // Borders, Shadows, etc.
  /^(?:bg|text|fill|stroke)-[-\w]+/, // Colors
  /^(?:flex|grid|inline|block|hidden|table|flow-root|contents)/, // Display & Layout
  /^(?:items|justify|content|self|place)-[-\w]+/, // Flex/Grid alignment
  /^(?:gap|space)-[-\w]+/,        // Gaps/Spacing
  /^(?:font|text|leading|tracking|whitespace|break|align|underline|italic|not-italic|antialiased|subpixel-antialiased)-[-\w]+/, // Typography
  /^(?:opacity|transform|translate|scale|rotate|skew|origin|transition|duration|ease|delay|animate)-[-\w]+/, // Effects & Transitions
  /^(?:z)-\d+/,                   // Z-index
  // Add prefixes for specific component libraries if known (e.g., /^Mui-/, /^ant-/)
];

/**
 * Filters a list of classes, removing those matching the defined patterns.
 * @param {string[]} classList Array of class names.
 * @returns {string[]} Filtered array of class names.
 */
function filterClasses(classList) {
  if (!classList || classList.length === 0) {
    return [];
  }
  return classList.filter(className =>
    !CLASS_FILTER_PATTERNS.some(pattern => pattern.test(className))
  );
}


/**
 * Tries to make a selector unique within its parent by adding a single,
 * relevant class if necessary and possible. Filters out noisy/framework classes.
 * @param {string} baseSelector The selector without classes (e.g., 'button:nth-of-type(1)')
 * @param {Element} element The target element
 * @param {Element} parent The parent element
 * @returns {string} The refined selector, or the original if refinement doesn't help or isn't needed.
 */
function refineWithClasses(baseSelector, element, parent) {
  // 1. Check if already unique
  if (isUniqueSelector(baseSelector, element, parent)) {
    // console.debug(`Selector "${baseSelector}" is already unique.`);
    return baseSelector;
  }
  // console.debug(`Selector "${baseSelector}" is not unique. Attempting refinement...`);

  // 2. Get and filter classes
  const allClasses = Array.from(element.classList);
  const relevantClasses = filterClasses(allClasses);

  // 3. Check if refinement is possible
  if (!relevantClasses.length) {
    // console.debug("No relevant classes found after filtering. Cannot refine further with classes.");
    return baseSelector; // No useful classes to add
  }
  // console.debug(`Relevant classes found: [${relevantClasses.join(', ')}]`);

  // 4. Try adding one class at a time
  for (const cls of relevantClasses) {
    // Important: Escape class names for use in CSS selectors
    const escapedClass = CSS.escape(cls);
    const potentialSelector = `${baseSelector}.${escapedClass}`;
    // console.debug(`Trying selector: "${potentialSelector}"`);

    if (isUniqueSelector(potentialSelector, element, parent)) {
      // console.debug(`Selector "${potentialSelector}" is unique! Using it.`);
      return potentialSelector; // Found a unique selector with one class
    }
  }

  // 5. Fallback if no single class worked
  // console.debug(`No single class addition made the selector "${baseSelector}" unique. Returning base selector.`);
  return baseSelector; // Stick to the original if single classes don't help
}


/**
 * Generates a relative CSS selector fragment using tag and nth-of-type.
 * Uses space combinator logic implicitly later.
 * @param {Element} element
 * @returns {string} e.g., 'div' or 'button:nth-of-type(2)'
 */
function getBaseRelativeFragment(element) {
  const tagName = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) return tagName;

  const siblings = Array.from(parent.children);
  const sameTagSiblings = siblings.filter(sib => sib.tagName === element.tagName);

  if (sameTagSiblings.length === 1) {
    return tagName; // Only one of this tag? Use tag name only.
  }

  // Calculate :nth-of-type index
  let index = 1;
  let currentSibling = element.previousElementSibling;
  while (currentSibling) {
    if (currentSibling.tagName === element.tagName) {
      index++;
    }
    currentSibling = currentSibling.previousElementSibling;
  }
  return `${tagName}:nth-of-type(${index})`;
}

/**
 * Generates a robust CSS selector using IDs and the child combinator '>'.
 * Path is built from target upwards, potentially stopping at a unique ID ancestor.
 * @param {Element} element The target element.
 * @param {Element} [contextElement=document] The ancestor context (defaults to document).
 * @returns {string|null} A CSS selector string, or null if generation fails.
 */
export function generateCssSelector(element, contextElement = document) {
  if (!element || !(element instanceof Element)) {
    console.error("generateCssSelector: Invalid element provided.");
    return null;
  }
  if (!contextElement || !(contextElement instanceof Element || contextElement instanceof Document)) {
    console.error("generateCssSelector: Invalid contextElement provided.");
    return null;
  }

  // Ensure contextElement contains or is the element, fallback to document if not
  if (contextElement !== document && !contextElement.contains(element)) {
    console.warn("generateCssSelector: Element is not within the specified contextElement. Using document context.");
    contextElement = document;
  }

  // --- Rule 1: ID Priority (on the element itself) ---
  if (element.id) {
    const idSelector = `#${CSS.escape(element.id)}`;
    if (isUniqueSelector(idSelector, element, contextElement)) {
      // console.debug(`Unique ID found on element: ${idSelector}`);
      return idSelector;
    }
    console.warn(`ID "${element.id}" on element is not unique within the context. Generating path instead.`);
  }

  if (element === contextElement) {
    // console.debug("generateCssSelector: Element is the contextElement, cannot generate selector.");
    return null;
  }

  const parts = [];
  let current = element;

  while (current && current !== contextElement && current.parentElement /* Stop at documentElement */) {

    // --- Get basic fragment (tag + nth-of-type/unique tag) ---
    let fragment = getBaseRelativeFragment(current);

    // --- Refine fragment with classes if needed for uniqueness *within its direct parent* ---
    // Ensure parentElement exists and is not the stopping contextElement
    if (current.parentElement && current.parentElement !== contextElement) {
      // Use current.parentElement as the context for refinement checks
      fragment = refineWithClasses(fragment, current, current.parentElement);
    }

    parts.unshift(fragment); // Add refined fragment to the beginning of the path array

    const parent = current.parentElement;

    // --- Optimization: Check for ID Anchor on Parent ---
    if (parent && parent !== contextElement && parent.id) {
      const parentIdSelector = `#${CSS.escape(parent.id)}`;
      // Check if this parent ID is unique *within the original context*
      if (isUniqueSelector(parentIdSelector, parent, contextElement)) {
        // ID anchor found. Construct the precise path from this anchor.
        const pathFromAnchor = parts.join(' > ');
        const finalSelector = `${parentIdSelector} > ${pathFromAnchor}`;

        // console.debug(`ID Anchor found: ${parentIdSelector}. Testing precise selector: ${finalSelector}`);

        // Verify the complete selector anchored to the ID is unique within the original context
        if (isUniqueSelector(finalSelector, element, contextElement)) {
          // console.debug(`Using ID anchored selector: ${finalSelector}`);
          return finalSelector;
        } else {
          // This is unusual - means the path below the unique ID is still ambiguous within the context.
          console.warn(`Selector anchored to unique ID "${parent.id}" was not unique overall. Continuing path generation upwards.`);
          // We simply continue the loop without using this ID as the final anchor.
          // The ID element itself might still become part of the path later.
        }
      }
    }

    // --- Continue traversal ---
    // Stop if parent is the context or we've reached the top level implicitly
    if (!parent || parent === contextElement) {
      break;
    }
    current = parent;

  } // End while loop

  // --- Construct final selector using child combinator if no ID anchor shortcut was taken ---
  const finalSelector = parts.join(' > ');

  // --- Final Verification ---
  // Check if the generated path selector is unique within the original context
  if (finalSelector && isUniqueSelector(finalSelector, element, contextElement)) {
    // console.debug(`Generated final path selector: ${finalSelector}`);
    return finalSelector;
  } else {
    // Fallback or error if the path isn't unique
    console.warn(`Generated path selector "${finalSelector}" is not unique within the context or failed validation.`);
    // Option: Return the non-unique selector anyway
    // return finalSelector;
    // Option: Return null to indicate failure
    return null;
  }
}


/**
 * Generates XPath selector.
 * Rules: ID > Nth-Sibling index.
 * @param {Element} element The target element
 * @param {Element} [contextElement=document] The ancestor context
 * @returns {string|null} XPath selector or null
 */
export function generateXPath(element, contextElement = document) {
  if (!element || !(element instanceof Element)) return null;

  // Rule 1: ID Priority
  if (element.id) {
    const xpath = `//*[@id='${element.id}']`;
    // Simple check if ID exists, assuming it's unique for XPath generation
    // A full XPath uniqueness check is more complex
    return xpath;
  }

  if (element === contextElement || element === document.body || element === document.documentElement) {
    return '/html/' + element.tagName.toLowerCase();
  }

  let index = 1;
  let sibling = element.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === element.tagName) {
      index++;
    }
    sibling = sibling.previousElementSibling;
  }

  const parentPath = generateXPath(element.parentElement, contextElement); // Recurse
  if (!parentPath) return null; // Stop if parent path fails

  // Rule 2: Nth-Sibling Fallback (using index)
  return `${parentPath}/${element.tagName.toLowerCase()}[${index}]`;
}


/**
 * Counts elements matching a selector within a context.
 * @param {string} selector CSS or XPath
 * @param {'css'|'xpath'} type
 * @param {Document|Element} contextElement
 * @returns {number} Count of matching elements
 */
export function countElements(selector, type, contextElement) {
  if (!selector || !contextElement) return 0;
  try {
    if (type === 'css') {
      return contextElement.querySelectorAll(selector).length;
    } else if (type === 'xpath') {
      const result = document.evaluate(`count(${selector})`, contextElement, null, XPathResult.NUMBER_TYPE, null);
      return result.numberValue;
    }
  } catch (e) {
    console.error(`Error counting elements for ${type} selector "${selector}":`, e);
    return 0; // Return 0 on error (e.g., invalid syntax)
  }
  return 0;
}

/**
 * Finds the parent DOM element using its stored selector.
 * @param {{css: string|null, xpath: string|null}} parentSelectors
 * @returns {Element|null} The found parent element or null.
 */
export function findParentElement(parentSelectors) {
  if (!parentSelectors) return null;
  let parentElement = null;
  try {
    if (parentSelectors.css) {
      parentElement = document.querySelector(parentSelectors.css);
    }
    // Optional: Fallback to XPath if CSS fails or isn't present
    if (!parentElement && parentSelectors.xpath) {
      const result = document.evaluate(parentSelectors.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      parentElement = result.singleNodeValue;
    }
  } catch (e) {
    console.error("Error finding parent element:", e);
    return null;
  }
  return parentElement;
}
