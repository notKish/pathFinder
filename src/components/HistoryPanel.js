import React from 'react';

function HistoryItem({ item, onCopy }) {
  const handleCopy = () => {
    onCopy(item.value);
  };

  return (
    <tr>
      <td>{item.type.toUpperCase()}</td>
      <td><code>{item.value}</code></td>
      <td>{item.count} found</td>
      <td>
        <button className="copy-btn" onClick={handleCopy} title="Copy Path">Copy</button>
      </td>
    </tr>
  );
}


function HistoryPanel({ history, isLoading, onCopy, onClear }) {
  return (
    <div className="panel history-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3>Search History (Max 10)</h3>
        <button onClick={onClear} disabled={history.length === 0} style={{ backgroundColor: '#dc3545', fontSize: '11px', padding: '4px 8px' }}>Clear History</button>
      </div>

      {isLoading ? (
        <p className="history-placeholder">Loading history...</p>
      ) : history.length === 0 ? (
        <p className="history-placeholder">No search history yet.</p>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Path</th>
              <th>Count</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              // Use value + timestamp as key for potential duplicates if timestamp added
              <HistoryItem key={`${item.type}-${item.value}-${item.timestamp}`} item={item} onCopy={onCopy} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default HistoryPanel;
