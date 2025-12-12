import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

interface Webhook {
    id: number;
    url: string;
    events: string[];
    table_name: string | null;
    target_column: string | null;
    active: boolean;
}

interface Listener {
    id: number;
    uuid: string;
    name: string;
    created_at: string;
}

interface Log {
    id: number;
    method: string;
    headers: any;
    body: any;
    timestamp: string;
}

interface WebhookManagerProps {
    selectedTable: string;
    setSelectedTable: (table: string) => void;
    selectedColumn: string;
    setSelectedColumn: (col: string) => void;
    onAction: (msg: string | any) => void;
}

export default function WebhookManager({
    selectedTable,
    setSelectedTable,
    selectedColumn,
    setSelectedColumn,
    onAction
}: WebhookManagerProps) {
    // Data States
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [listeners, setListeners] = useState<Listener[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [columns, setColumns] = useState<string[]>([]);

    // Form States
    const [url, setUrl] = useState('');
    const [selectedMethod, setSelectedMethod] = useState('POST'); // Default method for registration (hidden in main, set in modal)

    // Modal & Sidebar States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sidebarListener, setSidebarListener] = useState<Listener | null>(null);

    // Create Listener Form
    const [listenerName, setListenerName] = useState('');

    const eventsList = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'PULL', 'INSERT', 'UPDATE'];
    const methodOptions = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'PULL'];

    useEffect(() => {
        fetchWebhooks();
        fetchTables();
        fetchListeners();
    }, []);

    useEffect(() => {
        if (selectedTable) {
            fetchColumns(selectedTable);
        } else {
            setColumns([]);
            setSelectedColumn('');
        }
    }, [selectedTable]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (sidebarListener) {
            fetchLogs(sidebarListener.id);
            interval = setInterval(() => fetchLogs(sidebarListener.id), 2000);
        }
        return () => clearInterval(interval);
    }, [sidebarListener]);

    const fetchTables = async () => {
        try {
            const res = await axios.get(`${API_URL}/tables`);
            setTables(res.data);
        } catch (err) {
            console.error('Failed to fetch tables', err);
        }
    };

    const fetchColumns = async (tableName: string) => {
        try {
            const res = await axios.get(`${API_URL}/tables/${tableName}/columns`);
            setColumns(res.data);
        } catch (err) {
            console.error('Failed to fetch columns', err);
        }
    };

    const fetchWebhooks = async () => {
        try {
            const res = await axios.get(`${API_URL}/webhooks`);
            setWebhooks(res.data);
        } catch (err) {
            console.error('Failed to fetch webhooks', err);
        }
    };

    const fetchListeners = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/listeners`);
            setListeners(res.data);
        } catch (err) {
            console.error('Failed to fetch listeners', err);
        }
    };

    const fetchLogs = async (listenerId: number) => {
        try {
            const res = await axios.get(`${API_URL}/api/listeners/${listenerId}/logs`);
            setLogs(res.data);
        } catch (err) {
            console.error('Failed to fetch logs', err);
        }
    };

    const createListener = async () => {
        try {
            const res = await axios.post(`${API_URL}/api/listeners`, { name: listenerName || 'Untitled Listener' });
            setListeners([res.data, ...listeners]);

            // Post-creation flow
            const newUrl = `${API_URL}/api/listeners/${res.data.uuid}/trigger`;
            setUrl(newUrl); // Fill input

            // Map modal selection to trigger event
            let mappedEvent = 'ALL';
            if (selectedMethod === 'POST') mappedEvent = 'INSERT';
            else if (selectedMethod === 'PUT' || selectedMethod === 'PATCH') mappedEvent = 'UPDATE';
            else if (selectedMethod === 'DELETE') mappedEvent = 'DELETE';
            else if (selectedMethod === 'GET') mappedEvent = 'GET';
            else mappedEvent = 'ALL';

            setTriggerEvent(mappedEvent);

            setIsModalOpen(false); // Close Modal
            setListenerName('');

            onAction({
                headers: { system: "true" },
                body: { event: "SYSTEM", table: "N/A", data: { message: `🆕 Created Local Listener: ${res.data.name}` } }
            });

        } catch (err) {
            console.error('Failed to create listener', err);
        }
    };

    const [triggerEvent, setTriggerEvent] = useState('ALL');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const tableToSend = selectedTable === 'ALL' || selectedTable === '' ? null : selectedTable;
            const columnToSend = selectedColumn === 'ALL' || selectedColumn === '' ? null : selectedColumn;

            // Logic to determine events based on triggerEvent (Main Form)
            let eventsToSend: string[] = [];

            if (triggerEvent === 'ALL') {
                eventsToSend = eventsList;
            } else if (triggerEvent === 'INSERT') {
                eventsToSend = ['INSERT', 'POST'];
            } else if (triggerEvent === 'UPDATE') {
                eventsToSend = ['UPDATE', 'PUT', 'PATCH'];
            } else if (triggerEvent === 'DELETE') {
                eventsToSend = ['DELETE'];
            } else if (triggerEvent === 'GET') {
                eventsToSend = ['GET', 'PULL'];
            }

            // Deduplicate
            eventsToSend = [...new Set(eventsToSend)];

            await axios.post(`${API_URL}/webhooks`, {
                url,
                events: eventsToSend,
                table_name: tableToSend,
                target_column: columnToSend
            });
            setUrl('');
            fetchWebhooks();
            onAction({
                headers: { system: "true" },
                body: { event: "SYSTEM", table: tableToSend || 'Global', data: { message: `📝 Registered Webhook: ${triggerEvent} on ${tableToSend || 'Global'}` } }
            });
        } catch (err) {
            console.error('Failed to create webhook', err);
        }
    };

    const toggleWebhook = async (wh: Webhook) => {
        // Optimistic Update
        setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, active: !w.active } : w));

        try {
            await axios.put(`${API_URL}/webhooks/${wh.id}`, { active: !wh.active });
            fetchWebhooks(); // Sync
            onAction({
                headers: { system: "true" },
                body: { event: "SYSTEM", table: "N/A", data: { message: `${!wh.active ? '▶️ Enabled' : '⏸️ Disabled'} Webhook ID ${wh.id}` } }
            });
        } catch (err) {
            console.error('Failed to update webhook', err);
            // Revert on error
            setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, active: wh.active } : w));
        }
    };



    const handleDeleteWebhook = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this webhook?')) return;

        // Optimistic Delete
        const previousWebhooks = [...webhooks];
        setWebhooks(prev => prev.filter(w => w.id !== id));

        try {
            await axios.delete(`${API_URL}/webhooks/${id}`);
            // No need to fetchWebhooks if successful, state is already correct
            onAction({
                headers: { system: "true" },
                body: { event: "SYSTEM", table: "N/A", data: { message: `🗑️ Deleted Webhook ID ${id}` } }
            });
        } catch (err) {
            console.error('Failed to delete webhook', err);
            // Revert on error
            setWebhooks(previousWebhooks);
            alert('Failed to delete webhook. Check console.');
        }
    };

    // Helper to check if a webhook is "Local" (belongs to one of our listeners) and return that listener
    const getLocalListener = (webhookUrl: string) => {
        return listeners.find(l => webhookUrl.includes(l.uuid));
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                {/* Header removed as it is in the Card title in App.tsx */}
            </div>

            {/* Main Create/Register Form */}
            <form onSubmit={handleSubmit} className="secondary-area">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <label>Webhook URL</label>
                    <button type="button" onClick={() => setIsModalOpen(true)} className="primary-btn" style={{ width: 'auto', fontSize: '0.8em', padding: '6px 12px' }}>
                        + Create Local Webhook
                    </button>
                </div>

                <input
                    type="text"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://your-api.com/webhook"
                    required
                    style={{ marginBottom: '15px' }}
                />

                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ flex: 1 }}>
                        <label>Table</label>
                        <select
                            value={selectedTable}
                            onChange={e => setSelectedTable(e.target.value)}
                        >
                            <option value="">-- All Tables (Global) --</option>
                            {tables.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ flex: 1 }}>
                        <label>Trigger Event (Terms)</label>
                        <select
                            value={triggerEvent}
                            onChange={e => setTriggerEvent(e.target.value)}
                        >
                            <option value="ALL">All Events (Listen to everything)</option>
                            <option value="INSERT">Inserting (POST)</option>
                            <option value="UPDATE">Updating (PUT/PATCH)</option>
                            <option value="DELETE">Deleting (DELETE)</option>
                            <option value="GET">Retrieving (GET)</option>
                        </select>
                    </div>
                    {selectedTable && (
                        <div style={{ flex: 1 }}>
                            <label>Column (Optional)</label>
                            <select
                                value={selectedColumn}
                                onChange={e => setSelectedColumn(e.target.value)}
                                disabled={columns.length === 0}
                            >
                                <option value="">-- Any Column --</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div style={{ textAlign: 'right' }}>
                    <button type="submit" className="primary-btn" style={{ width: 'auto' }}>Register Webhook</button>
                </div>
            </form>

            {/* Active Webhooks List */}
            <div className="webhook-list">
                <h3 style={{ marginTop: 0 }}>Active Webhooks ({webhooks.length})</h3>
                {webhooks.length === 0 && <p style={{ color: '#888' }}>No webhooks registered.</p>}
                {webhooks.map(wh => {
                    const localListener = getLocalListener(wh.url);

                    return (
                        <div key={wh.id} className="list-item" style={{ borderLeft: wh.active ? '4px solid #4CAF50' : '4px solid #666', opacity: wh.active ? 1 : 0.7 }}>
                            {/* Left: Info */}
                            <div style={{ flex: 1, marginRight: '15px' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '5px', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {wh.url}
                                    {localListener && (
                                        <button
                                            title="View Local Logs"
                                            onClick={() => setSidebarListener(localListener)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2em', padding: 0 }}
                                        >
                                            📊
                                        </button>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                    {wh.table_name || 'Global'} {wh.target_column ? `-> ${wh.target_column}` : ''}
                                </div>
                            </div>

                            {/* Right: Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    padding: '5px 10px',
                                    background: '#333',
                                    borderRadius: '4px',
                                    fontSize: '0.85em',
                                    color: '#fff',
                                    border: '1px solid #555',
                                    minWidth: '80px',
                                    textAlign: 'center'
                                }}>
                                    {(() => {
                                        const ev = wh.events || [];
                                        if (ev.length > 4) return 'ALL EVENTS';
                                        if (ev.includes('GATEKEEPER')) return '🔒 GATEKEEPER';
                                        if (ev.includes('INSERT')) return 'INSERTING';
                                        if (ev.includes('UPDATE')) return 'UPDATING';
                                        if (ev.includes('DELETE')) return 'DELETING';
                                        if (ev.includes('GET')) return 'RETRIEVING';
                                        return ev.join(', ');
                                    })()}
                                </span>

                                {/* Toggle */}
                                <label className="switch">
                                    <input type="checkbox" checked={wh.active} onChange={() => toggleWebhook(wh)} />
                                    <span className="slider"></span>
                                </label>

                                <button
                                    onClick={() => handleDeleteWebhook(wh.id)}
                                    className="delete-btn"
                                    style={{ padding: '4px 8px', fontSize: '0.9em' }}
                                    title="Delete"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal: Create Local Listener */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginTop: 0 }}>Create Local Webhook</h3>
                        <div className="form-group">
                            <label>Name / Title</label>
                            <input
                                type="text"
                                value={listenerName}
                                onChange={e => setListenerName(e.target.value)}
                                placeholder="My Webhook Listener"
                            />
                        </div>

                        <div className="form-group">
                            <label>Method Check</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
                                {methodOptions.map(m => (
                                    <label key={m} style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '0.9em',
                                        background: selectedMethod === m ? '#646cff' : 'transparent',
                                        color: selectedMethod === m ? '#fff' : '#ccc',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: selectedMethod === m ? '1px solid #646cff' : '1px solid #555'
                                    }}>
                                        <input
                                            type="radio"
                                            name="modalMethod"
                                            value={m}
                                            checked={selectedMethod === m}
                                            onChange={e => setSelectedMethod(e.target.value)}
                                            style={{ display: 'none' }}
                                        />
                                        {m}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: '1px solid #555', color: '#fff' }}>Cancel</button>
                            <button onClick={createListener} className="primary-btn" style={{ width: 'auto' }}>Generate & Fill</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar: Logs */}
            {sidebarListener && (
                <>
                    <div
                        onClick={() => setSidebarListener(null)}
                        className="drawer-overlay"
                    />
                    <div className="drawer">
                        <div className="drawer-header">
                            <h3 style={{ margin: 0 }}>{sidebarListener.name}</h3>
                            <button onClick={() => setSidebarListener(null)} style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', color: '#fff' }}>&times;</button>
                        </div>

                        <div className="drawer-body">
                            <h4 style={{ marginTop: 0 }}>Live Logs</h4>
                            <p style={{ fontSize: '0.8em', color: '#888' }}>Polling every 2s...</p>

                            {logs.length === 0 && <span style={{ color: '#666' }}>No events received yet.</span>}
                            {logs.map(log => (
                                <div key={log.id} className="log-entry">
                                    <div className="log-header">
                                        <span style={{ fontWeight: 'bold', color: '#646cff' }}>{log.method}</span>
                                        <span style={{ fontSize: '0.8em', color: '#888' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <pre>{JSON.stringify(log.body, null, 2)}</pre>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
