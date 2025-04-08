import React from 'react';

function InspectorPanel({
  title,
  targetId, // 'parent' or 'child'
  selectors, // { css, xpath }
  counts, // { css, xpath }
  error,
  isInspecting, // boolean: is this panel's target currently being inspected?
  onInspect,
  onCopy
}) {

  const handleCopy = (type) => {
    const value = selectors?.[type];
    if (value) {
      navigator.clipboard.writeText(value)
        .then(() => console.log(`${type} path copied!`))
        .catch(err => console.error(`Failed to copy ${type}:`, err));
    }
  };

  const getCountClass = (count) => {
    if (count === null || count === undefined) return '';
    if (count === 1) return 'success';
    if (count > 1) return 'multiple';
    return ''; // for 0
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <button onClick={() => onInspect(targetId)} disabled={isInspecting}>
          {isInspecting ? 'Inspecting...' : `Inspect ${targetId === 'parent' ? 'Parent' : 'Child'}`}
        </button>
      </div>

      {error && <p className="selector-count error" style={{ marginBottom: '10px' }}>Error: {error}</p>}

      <div className="selector-display">
        <label>CSS Path:</label>
        <code>{selectors?.css || ''}</code>
        <div className="selector-info">
          <span className={`selector-count ${getCountClass(counts?.css)}`}>
            {counts?.css !== null && counts?.css !== undefined ? `${counts.css} found` : ''}
          </span>
          <button
            className="copy-btn"
            onClick={() => handleCopy('css')}
            disabled={!selectors?.css}
            title="Copy CSS Path"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="selector-display">
        <label>XPath:</label>
        <code>{selectors?.xpath || ''}</code>
        <div className="selector-info">
          <span className={`selector-count ${getCountClass(counts?.xpath)}`}>
            {counts?.xpath !== null && counts?.xpath !== undefined ? `${counts.xpath} found` : ''}
          </span>
          <button
            className="copy-btn"
            onClick={() => handleCopy('xpath')}
            disabled={!selectors?.xpath}
            title="Copy XPath"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

export default InspectorPanel;
