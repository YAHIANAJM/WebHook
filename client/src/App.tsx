import { useState, useEffect } from 'react'
import axios from 'axios';
import './App.css'
import WebhookManager from './components/WebhookManager.tsx'

const API_URL = 'http://localhost:3000';

// Types for Dashboard
interface DashboardItem {
  id: string;
  time: string;
  type: 'WEBHOOK_RECEIVED' | 'SIMULATOR' | 'SYSTEM';
  summary: string;
  payload?: any; // The full n8n-style object
}

function App() {
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedColumn, setSelectedColumn] = useState('');
  const [dashboardLogs, setDashboardLogs] = useState<DashboardItem[]>([]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'JSON' | 'Table' | 'Schema'>('JSON');

  // Poll for real logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/logs/all`);
        const serverLogs: any[] = res.data;

        // Transform server logs to DashboardItems
        const newItems: DashboardItem[] = serverLogs.map(log => {
          // Parse JSON strings from DB
          let body = {};
          let headers = {};
          try { body = typeof log.body === 'string' ? JSON.parse(log.body) : log.body; } catch (e) { }
          try { headers = typeof log.headers === 'string' ? JSON.parse(log.headers) : log.headers; } catch (e) { }

          return {
            id: `server-${log.id}`,
            time: new Date(log.timestamp).toLocaleTimeString(),
            type: 'WEBHOOK_RECEIVED',
            summary: `${log.listener_name}: ${log.method} received`,
            payload: {
              headers,
              body,
              query: {},
              params: {}
            }
          };
        });

        // Merge and deduplicate
        setDashboardLogs(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = newItems.filter(i => !existingIds.has(i.id));
          if (uniqueNew.length === 0) return prev;
          return [...uniqueNew, ...prev].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 50);
        });
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const interval = setInterval(fetchLogs, 2000);
    fetchLogs(); // Initial call
    return () => clearInterval(interval);
  }, []);

  const addToDashboard = (msg: string | any) => {
    const time = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substr(2, 9);

    let newItem: DashboardItem;

    if (typeof msg === 'string') {
      newItem = {
        id,
        time,
        type: msg.includes('SIMULATOR') ? 'SIMULATOR' : 'SYSTEM',
        summary: msg,
      };
    } else {
      // It's a full payload object (n8n style)
      newItem = {
        id,
        time,
        type: 'WEBHOOK_RECEIVED',
        summary: `${msg.body.event} on ${msg.body.table}`,
        payload: msg
      };
    }

    setDashboardLogs(prev => [newItem, ...prev].slice(0, 50));
    // Auto-select first if none selected
    if (!selectedLogId) setSelectedLogId(id);
  };

  // Clear all logs
  const handleClearAll = async () => {
    try {
      await axios.delete(`${API_URL}/api/logs/clear`);
      setDashboardLogs([]);
      setSelectedLogId(null);
    } catch (err) {
      console.error('Failed to clear logs', err);
    }
  };

  // Delete single log
  const handleDeleteLog = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      if (id.startsWith('server-')) {
        const serverId = id.replace('server-', '');
        await axios.delete(`${API_URL}/api/logs/${serverId}`);
      }
      setDashboardLogs(prev => prev.filter(l => l.id !== id));
      if (selectedLogId === id) setSelectedLogId(null);
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  };

  const activeLog = dashboardLogs.find(l => l.id === selectedLogId) || dashboardLogs[0];

  return (
    <div className="container">
      <h1>Web Hook Management</h1>

      {/* Global Dashboard (n8n Style) */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '5px solid #ff6d5a', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', background: '#2c2c2c', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>⚡ Execution Dashboard</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ fontSize: '0.9em', color: '#aaa' }}>{dashboardLogs.length} executions</div>
            <button
              onClick={handleClearAll}
              title="Clear All Logs"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1em', padding: 0 }}
            >
              🗑️
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', height: '400px' }}>
          {/* Sidebar List */}
          <div style={{ width: '250px', borderRight: '1px solid #444', overflowY: 'auto', background: '#1e1e1e' }}>
            {dashboardLogs.length === 0 && <div style={{ padding: '20px', color: '#666', fontSize: '0.9em' }}>Waiting for events...</div>}
            {dashboardLogs.map(log => (
              <div
                key={log.id}
                onClick={() => setSelectedLogId(log.id)}
                style={{
                  padding: '10px 15px',
                  cursor: 'pointer',
                  borderLeft: activeLog?.id === log.id ? '3px solid #ff6d5a' : '3px solid transparent',
                  background: activeLog?.id === log.id ? '#2c2c2c' : 'transparent',
                  color: '#e0e0e0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  group: 'row' // for hover targeting if using CSS, but simplistic approach here
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '2px' }}>{log.time}</div>
                  <div style={{ fontSize: '0.9em', fontWeight: activeLog?.id === log.id ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.summary}</div>
                </div>
                <button
                  onClick={(e) => handleDeleteLog(e, log.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: log.id === selectedLogId ? '#fff' : '#666',
                    cursor: 'pointer',
                    padding: '2px',
                    fontSize: '1em',
                    lineHeight: 1
                  }}
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          {/* Detail View */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#141414', overflow: 'hidden' }}>
            {activeLog ? (
              <>
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #333', background: '#222' }}>
                  {['JSON', 'Table', 'Schema'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as any)}
                      style={{
                        background: viewMode === mode ? '#141414' : 'transparent',
                        border: 'none',
                        color: viewMode === mode ? '#ff6d5a' : '#888',
                        padding: '10px 20px',
                        cursor: 'pointer',
                        borderTop: viewMode === mode ? '2px solid #ff6d5a' : '2px solid transparent',
                        fontSize: '0.9em'
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0', position: 'relative' }}>
                  {activeLog.payload ? (
                    viewMode === 'JSON' ? (
                      <pre style={{ margin: 0, padding: '20px', fontSize: '0.85em', color: '#a6e22e', fontFamily: 'details-code, monospace' }}>
                        {JSON.stringify([activeLog.payload], null, 2)}
                      </pre>
                    ) : viewMode === 'Table' ? (
                      <div style={{ padding: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: '#888' }}><th style={{ paddingBottom: '10px' }}>Key</th><th style={{ paddingBottom: '10px' }}>Value</th></tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const body = activeLog.payload.body || {};
                              // Use body.data only if it looks like an n8n payload (has event/table), otherwise use whole body
                              const source = (body.event && body.table && body.data) ? body.data : body;

                              return Object.entries(source).map(([k, v]) => (
                                <tr key={k} style={{ borderBottom: '1px solid #333' }}>
                                  <td style={{ padding: '8px 0', color: '#ff6d5a' }}>{k}</td>
                                  <td style={{ padding: '8px 0', color: '#ddd' }}>
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ padding: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', color: '#888' }}><th style={{ paddingBottom: '10px' }}>Field</th><th style={{ paddingBottom: '10px' }}>Type</th></tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const body = activeLog.payload.body || {};
                              const source = (body.event && body.table && body.data) ? body.data : body;

                              return Object.entries(source).map(([k, v]) => (
                                <tr key={k} style={{ borderBottom: '1px solid #333' }}>
                                  <td style={{ padding: '8px 0', color: '#66d9ef' }}>{k}</td>
                                  <td style={{ padding: '8px 0', color: '#a6e22e' }}>{typeof v}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    <div style={{ padding: '20px', color: '#888', fontStyle: 'italic' }}>
                      System Notification: {activeLog.summary}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                Select an execution to view details
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ width: '100%', boxSizing: 'border-box' }}>
        <h2>Manage Webhooks</h2>
        <p>Register URLs to receive notifications when data changes.</p>
        <WebhookManager
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          selectedColumn={selectedColumn}
          setSelectedColumn={setSelectedColumn}
          onAction={addToDashboard}
        />
      </div>
      <div className="instructions">
        <h3>How it works:</h3>
        <ol>
          <li>PostgreSQL Trigger detects changes (INSERT/UPDATE/DELETE).</li>
          <li>Trigger sends <code>pg_notify</code> event to "table_changes" channel.</li>
          <li>Node.js Listener receives event.</li>
          <li>Server matches event to registered webhooks.</li>
          <li>Server sends HTTP POST to your URL.</li>
        </ol>
      </div>
    </div>
  )
}

export default App
