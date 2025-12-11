import { useState } from 'react'
import './App.css'
import WebhookManager from './components/WebhookManager.tsx'
import DataSimulator from './components/DataSimulator.tsx'

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

  const activeLog = dashboardLogs.find(l => l.id === selectedLogId) || dashboardLogs[0];

  return (
    <div className="container">
      <h1>PostgreSQL Webhook System</h1>

      {/* Global Dashboard (n8n Style) */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '5px solid #ff6d5a', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', background: '#2c2c2c', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>⚡ Execution Dashboard</h2>
          <div style={{ fontSize: '0.9em', color: '#aaa' }}>{dashboardLogs.length} executions</div>
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
                  color: '#e0e0e0'
                }}
              >
                <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '2px' }}>{log.time}</div>
                <div style={{ fontSize: '0.9em', fontWeight: activeLog?.id === log.id ? 600 : 400 }}>{log.summary}</div>
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
                            {Object.entries(activeLog.payload.body?.data || {}).map(([k, v]) => (
                              <tr key={k} style={{ borderBottom: '1px solid #333' }}>
                                <td style={{ padding: '8px 0', color: '#ff6d5a' }}>{k}</td>
                                <td style={{ padding: '8px 0', color: '#ddd' }}>{String(v)}</td>
                              </tr>
                            ))}
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
                            {Object.entries(activeLog.payload.body?.data || {}).map(([k, v]) => (
                              <tr key={k} style={{ borderBottom: '1px solid #333' }}>
                                <td style={{ padding: '8px 0', color: '#66d9ef' }}>{k}</td>
                                <td style={{ padding: '8px 0', color: '#a6e22e' }}>{typeof v}</td>
                              </tr>
                            ))}
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

      <div className="grid">
        <div className="card">
          <h2>1. Manage Webhooks</h2>
          <p>Register URLs to receive notifications when data changes.</p>
          <WebhookManager
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            selectedColumn={selectedColumn}
            setSelectedColumn={setSelectedColumn}
            onAction={addToDashboard}
          />
        </div>
        <div className="card">
          <h2>2. Simulate Data Changes</h2>
          <p>Insert/Update data in the selected table to trigger webhooks.</p>
          <DataSimulator
            targetTable={selectedTable}
            targetColumn={selectedColumn}
            onAction={addToDashboard}
          />
        </div>
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
