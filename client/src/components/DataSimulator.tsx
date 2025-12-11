import { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3000';

interface DataSimulatorProps {
    targetTable: string;
    targetColumn?: string;
    onAction: (msg: string | any) => void;
}

export default function DataSimulator({ targetTable, targetColumn, onAction }: DataSimulatorProps) {
    const [name, setName] = useState('');
    const [action, setAction] = useState('POST');
    const [log, setLog] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const addLog = (msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 5));
    };

    const createData = async () => {
        // Use default table if none selected
        const actualTable = targetTable || 'test_webhook';

        if (!name && !['DELETE', 'GET', 'PULL'].includes(action)) return;

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/test-data`, {
                name,
                table: actualTable,
                action
            });

            // Restore missing variables
            // @ts-ignore
            const target = res.data._table || 'table';
            // @ts-ignore
            const act = res.data._action || action;
            // @ts-ignore
            const realHeaders = res.data._headers || {};

            // Construct n8n-style object
            const n8nPayload = {
                headers: {
                    ...realHeaders,
                    "x-simulator": "true"
                },
                params: {},
                query: {},
                body: {
                    event: action,
                    table: actualTable,
                    column_check: targetColumn || 'ALL',
                    data: res.data.data, // The returned row
                    old_data: null, // Simulator usually inserts plain new data
                    timestamp: new Date().toISOString()
                },
                webhookUrl: "http://localhost:3000/api/simulator-action",
                executionMode: "test"
            };

            const successMsg = `✅ SIMULATOR: ${act} on ${target}`;
            addLog(successMsg);
            onAction(n8nPayload); // Send OBJECT now

            if (['POST', 'INSERT'].includes(action)) setName('');
        } catch (err: any) {
            const errMsg = err.response?.data?.error || err.message;
            const failMsg = `❌ SIMULATOR Error: ${errMsg}`;
            addLog(failMsg);
            onAction(failMsg); // Keep error as string for now, or make obj? App supports string.
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Target Table display removed to avoid duplication with Card 1 */}

            <div className="form-group">
                <label>Action Type (Simulated)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'PULL'].map(act => (
                        <label key={act} style={{
                            cursor: 'pointer',
                            background: action === act ? '#444' : 'transparent',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: action === act ? '1px solid #646cff' : '1px solid #555',
                            color: action === act ? '#fff' : '#ccc'
                        }}>
                            <input
                                type="radio"
                                name="action"
                                value={act}
                                checked={action === act}
                                onChange={e => setAction(e.target.value)}
                                style={{ marginRight: '5px', width: 'auto' }}
                            />
                            {act}
                        </label>
                    ))}
                </div>
            </div>

            {!['DELETE', 'GET', 'PULL'].includes(action) && (
                <div className="form-group">
                    <label>Test Value (Body/Payload)</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. New Item Name"
                    />
                </div>
            )}

            <button onClick={createData} disabled={loading} className="primary-btn">
                {loading ? 'Processing...' : `Simulate ${action}`}
            </button>

            <div style={{ marginTop: '2rem' }}>
                <h4 style={{ borderBottom: '1px solid #444', paddingBottom: '5px', marginTop: 0 }}>Action Log</h4>
                {log.length === 0 && <p style={{ color: '#666', fontSize: '0.9em' }}>No actions yet.</p>}

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {log.map((l, i) => (
                        <div key={i} className="log-entry" style={{ padding: '5px' }}>
                            {l}
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '1rem', fontSize: '0.85em', color: '#888', fontStyle: 'italic' }}>
                    Tip: UPDATE/DELETE acts on the most recently created row.
                </div>
            </div>
        </div>
    );
}
