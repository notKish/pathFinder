import React, { useState, useCallback } from 'react';

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


function SearchPanel({ onSearch, searchResults, onClearHighlights }) {
  const [cssQuery, setCssQuery] = useState('');
  const [xpathQuery, setXpathQuery] = useState('');

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((type, value) => {
      if (value) {
        onSearch(type, value);
      } else {
        onClearHighlights(); // Clear if input is empty
      }
    }, 500), // 500ms debounce
    [onSearch, onClearHighlights]
  );

  const handleInputChange = (event, type) => {
    const value = event.target.value;
    if (type === 'css') {
      setCssQuery(value);
      debouncedSearch(type, value);
    } else {
      setXpathQuery(value);
      debouncedSearch(type, value);
    }
  };

  const getResultText = (type) => {
    const result = searchResults[type];
    if (result === null || result === undefined) return '';
    if (result.error) return <span style={{ color: 'red' }}>Error</span>;
    if (result.count !== null && result.count !== undefined) return `${result.count} found`;
    return '';
  }

  return (
    <div className="panel search-panel">
      <h3>Search & Highlight</h3>
      <div className="search-section">
        <label htmlFor="search-css">CSS:</label>
        <input
          type="text"
          id="search-css"
          placeholder="Enter CSS selector to find elements"
          value={cssQuery}
          onChange={(e) => handleInputChange(e, 'css')}
        />
        {/*<button onClick={() => handleSearch('css')} disabled={!cssQuery}>Search</button>*/}
        <span className="search-results">{getResultText('css')}</span>
      </div>
      <div className="search-section">
        <label htmlFor="search-xpath">XPath:</label>
        <input
          type="text"
          id="search-xpath"
          placeholder="Enter XPath to find elements"
          value={xpathQuery}
          onChange={(e) => handleInputChange(e, 'xpath')}
        />
        {/*<button onClick={() => handleSearch('xpath')} disabled={!xpathQuery}>Search</button>*/}
        <span className="search-results">{getResultText('xpath')}</span>
      </div>
      {(searchResults.css?.count > 0 || searchResults.xpath?.count > 0) &&
        <button onClick={onClearHighlights} style={{ marginTop: '5px', backgroundColor: '#dc3545' }}>Clear Highlights</button>
      }
    </div>
  );
}

export default SearchPanel;
