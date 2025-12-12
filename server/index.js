const express = require('express');
const { Pool, Client } = require('pg');
const cors = require('cors');
const dotenv = require('dotenv').config();
const axios = require('axios');

console.log(dotenv);
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Handle Form Data
app.use(express.text()); // Handle Raw Text

// JSON Syntax Error Handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Bad JSON received:', err.message);
    console.error('Body substring:', err.body ? err.body.substring(0, 100) : 'Empty');
    return res.status(400).json({ error: 'Invalid JSON payload', details: err.message });
  }
  next();
});

const PORT = process.env.PORT || 3000;

// Database Configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
};

// 1. Regular Pool for API queries
const pool = new Pool(dbConfig);

// 2. Dedicated Client for LISTEN
const listenerClient = new Client(dbConfig);

// Function to trigger webhooks
async function triggerWebhooks(payload) {
  console.log('Processing notification:', payload);
  try {
    // Simplify: Fetch all active webhooks and filter in JS to debug effectively
    const query = `SELECT * FROM webhooks WHERE active = true`;
    console.log(`Querying webhooks for op: ${payload.operation}, table: ${payload.table}`);
    const result = await pool.query(query);

    const allWebhooks = result.rows;
    const webhooks = [];

    for (const wh of allWebhooks) {
      // Check Event Match
      // We ensure wh.events includes the operation (e.g. 'POST')
      const eventMatch = wh.events.includes(payload.operation);

      // Check Table Match
      const tableMatch = wh.table_name === null || wh.table_name === payload.table;

      console.log(`Checking Webhook ${wh.id}: Events=[${wh.events}], Op=${payload.operation}, Table=[${wh.table_name}], Target=${payload.table} -> Match: ${eventMatch && tableMatch}`);

      if (eventMatch && tableMatch) {
        webhooks.push(wh);
      }
    }

    console.log(`Found ${webhooks.length} potentially matching webhooks (out of ${allWebhooks.length} active).`);

    for (const webhook of webhooks) {
      // If target_column is specified, verify that specific column changed
      if (webhook.target_column && payload.operation === 'UPDATE' && payload.old_data) {
        const col = webhook.target_column;
        const oldValue = payload.old_data[col];
        const newValue = payload.data[col];

        // Simple strict equality check
        if (oldValue === newValue) {
          console.log(`Skipping webhook ${webhook.url}: Column '${col}' did not change.`);
          continue;
        }
      }

      console.log(`Sending webhook to: ${webhook.url}`);
      try {
        await axios.post(webhook.url, {
          event: payload.operation,
          table: payload.table,
          column_check: webhook.target_column || 'ALL',
          data: payload.data,
          old_data: payload.old_data,
          timestamp: new Date().toISOString()
        });
        console.log(`Webhook sent successfully to ${webhook.url}`);
      } catch (err) {
        console.error(`Failed to send webhook to ${webhook.url}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error querying webhooks:', err);
  }
}

async function startListener() {
  await listenerClient.connect();
  await listenerClient.query('LISTEN table_changes');
  console.log('Listening for database changes on channel "table_changes"...');

  listenerClient.on('notification', (msg) => {
    try {
      const payload = JSON.parse(msg.payload);
      triggerWebhooks(payload);
    } catch (err) {
      console.error('Error parsing notification payload:', err);
    }
  });

  listenerClient.on('error', (err) => {
    console.error('Listener client error:', err);
    // In production, implement reconnection logic here
  });
}

startListener();

// API Endpoints

// GET /webhooks - List all webhooks
app.get('/webhooks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM webhooks ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /webhooks - Create a new webhook
app.post('/webhooks', async (req, res) => {
  const { url, events, table_name, target_column } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO webhooks (url, events, table_name, target_column) VALUES ($1, $2, $3, $4) RETURNING *',
      [url, events, table_name, target_column]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /webhooks/:id - Delete a webhook
app.delete('/webhooks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM webhooks WHERE id = $1', [id]);
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /webhooks/:id - Update a webhook
app.put('/webhooks/:id', async (req, res) => {
  const { id } = req.params;
  const { active, events } = req.body;

  try {
    // Dynamic update based on provided fields
    const fields = [];
    const values = [];
    let query = 'UPDATE webhooks SET ';

    if (active !== undefined) {
      fields.push(`active = $${fields.length + 1}`);
      values.push(active);
    }
    if (events !== undefined) {
      fields.push(`events = $${fields.length + 1}`);
      values.push(events);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    query += fields.join(', ') + ` WHERE id = $${fields.length + 1} RETURNING *`;
    values.push(id);

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --- Internal Webhook Listener (The Bin) --- */

const { v4: uuidv4 } = require('uuid');

// POST /api/listeners - Create a new internal listener
app.post('/api/listeners', async (req, res) => {
  const { name } = req.body;
  const uuid = uuidv4();
  try {
    const result = await pool.query(
      'INSERT INTO webhook_listeners (uuid, name) VALUES ($1, $2) RETURNING *',
      [uuid, name || 'Untitled Listener']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listeners - List all listeners
app.get('/api/listeners', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM webhook_listeners ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/listeners/:id - Delete a listener
app.delete('/api/listeners/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM webhook_listeners WHERE id = $1', [id]);
    res.json({ message: 'Listener deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/listeners/:uuid/trigger - The actual webhook target
app.post('/api/listeners/:uuid/trigger', async (req, res) => {
  const { uuid } = req.params;
  console.log(`Received payload for listener ${uuid}`);

  try {
    // 0. Check if this listener/webhook is globally disabled via the UI
    // The UI toggles the 'webhooks' table entry which points to this URL.
    const hookCheck = await pool.query(
      `SELECT active FROM webhooks WHERE url LIKE '%' || $1 || '/trigger' LIMIT 1`,
      [uuid]
    );

    if (hookCheck.rows.length > 0 && !hookCheck.rows[0].active) {
      console.log(`🚫 Listener ${uuid} is disabled in dashboard. Rejecting.`);
      return res.status(403).json({ error: 'Webhook is disabled' });
    }

    // 1. Find the listener
    const listenerRes = await pool.query('SELECT id FROM webhook_listeners WHERE uuid = $1', [uuid]);
    if (listenerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Listener not found' });
    }
    const listenerId = listenerRes.rows[0].id;

    // 2. Log the request
    await pool.query(
      'INSERT INTO listener_logs (listener_id, method, headers, body) VALUES ($1, $2, $3, $4)',
      [listenerId, req.method, JSON.stringify(req.headers), JSON.stringify(req.body)]
    );

    res.status(200).json({ message: 'Webhook received' });
  } catch (err) {
    console.error('Error logging webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listeners/:id/logs - Get logs for a specific listener
app.get('/api/listeners/:id/logs', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM listener_logs WHERE listener_id = $1 ORDER BY timestamp DESC LIMIT 50',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs/all - Get global logs from all listeners
app.get('/api/logs/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ll.*, wl.name as listener_name 
      FROM listener_logs ll
      JOIN webhook_listeners wl ON ll.listener_id = wl.id
      ORDER BY ll.timestamp DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/logs/clear - Clear all logs
app.delete('/api/logs/clear', async (req, res) => {
  try {
    await pool.query('DELETE FROM listener_logs');
    res.json({ message: 'All logs cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/logs/:id - Delete a specific log
app.delete('/api/logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM listener_logs WHERE id = $1', [id]);
    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Setup Database (Run Schema)
app.post('/setup-db', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    res.json({ message: 'Database schema applied successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: List all tables
app.get('/tables', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const internalTables = ['webhooks', 'webhook_listeners', 'listener_logs', 'schema_migrations'];
    const userTables = result.rows
      .map(row => row.table_name)
      .filter(name => !internalTables.includes(name));

    res.json(userTables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: List columns for a table
app.get('/tables/:name/columns', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
    `, [name]);

    res.json(result.rows.map(r => r.column_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gatekeeper Middleware
const gatekeeperMiddleware = async (req, res, next) => {
  try {
    // Find active Gatekeeper webhooks
    const result = await pool.query(`SELECT * FROM webhooks WHERE active = true AND 'GATEKEEPER' = ANY(events)`);
    const gatekeepers = result.rows;

    if (gatekeepers.length > 0) {
      console.log(`🔒 Gatekeeper: Checking ${gatekeepers.length} blocking webhooks...`);

      // Check all gatekeepers (in parallel for speed)
      const checks = gatekeepers.map(gh =>
        axios.post(gh.url, req.body, { timeout: 3000 }) // 3s timeout to avoid hanging
          .catch(err => {
            // If 4xx/5xx, axios throws. We want to catch that and throw a block error.
            throw new Error(`Blocked by ${gh.url}: ${err.response?.status || err.message}`);
          })
      );

      await Promise.all(checks);
      console.log('🔓 Gatekeeper: All checks passed.');
    }
    next();
  } catch (err) {
    console.warn('⛔ Gatekeeper Blocked Request:', err.message);
    return res.status(403).json({
      error: 'Request blocked by middleware webhook',
      details: err.message,
      gatekeeper_blocked: true
    });
  }
};

// Login Endpoint (Protected by Gatekeeper)
app.post('/login', gatekeeperMiddleware, async (req, res) => {
  const { email, password } = req.body;
  console.log(`🔐 Login Attempt: ${email}`);

  // Simulate Authentication (No DB required for this test, proves Middleware independence)
  if (email === 'admin@test.com' && password === '123456') {
    return res.json({ token: 'fake-jwt-token', message: 'Login Successful' });
  }

  return res.status(401).json({ error: 'Invalid Credentials' });
});

// Test Data Endpoint (Simulating an App Action)
app.post('/test-data', gatekeeperMiddleware, async (req, res) => {
  const { name, table, action = 'POST' } = req.body; // Default action POST
  // Remove strict table whitelist
  const targetTable = table || 'test_webhook';

  // Block simulation on internal system tables to prevent schema errors
  const restrictedTables = ['webhooks', 'webhook_listeners', 'listener_logs'];
  if (restrictedTables.includes(targetTable)) {
    return res.status(400).json({
      error: `Cannot simulate data on internal table '${targetTable}'. Please select a user table like 'test_webhook'.`
    });
  }

  const targetCol = targetTable === 'webhooks_test' ? 'message' : 'name';

  try {
    let query = '';
    let params = [];
    let dbResult = null;
    let oldData = null;

    // 1. Perform Database Operation
    if (action === 'POST' || action === 'INSERT') {
      if (targetTable === 'webhooks_test') {
        query = `INSERT INTO webhooks_test (message) VALUES ($1) RETURNING *`;
        params = [name];
      } else if (targetTable === 'test_webhook') {
        query = `INSERT INTO test_webhook (name, description) VALUES ($1, $2) RETURNING *`;
        params = [name, 'Test data created via API'];
      } else {
        // Generic fallback
        query = `INSERT INTO ${targetTable} (${targetCol}) VALUES ($1) RETURNING *`;
        params = [name];
      }
      const r = await pool.query(query, params);
      dbResult = r.rows[0];

    } else if (['PUT', 'PATCH', 'UPDATE'].includes(action)) {
      // A. Fetch current latest row to get "old_data"
      const selectQ = `SELECT * FROM ${targetTable} ORDER BY id DESC LIMIT 1`;
      const selectR = await pool.query(selectQ);

      if (selectR.rows.length > 0) {
        oldData = selectR.rows[0];

        // B. Perform Update
        query = `UPDATE ${targetTable} SET ${targetCol} = $1 WHERE id = $2 RETURNING *`;
        params = [name, oldData.id];
        const r = await pool.query(query, params);
        dbResult = r.rows[0];
      } else {
        // C. No data found -> Upsert
        console.log(`[${action}] No record found to update. Performing INSERT instead.`);
        if (targetTable === 'webhooks_test') {
          query = `INSERT INTO webhooks_test (message) VALUES ($1) RETURNING *`;
          params = [name];
        } else {
          query = `INSERT INTO test_webhook (name, description) VALUES ($1, $2) RETURNING *`;
          params = [name, 'Upserted via ' + action];
        }
        const insertR = await pool.query(query, params);
        dbResult = insertR.rows[0];
      }

    } else if (action === 'DELETE') {
      // Fetch before delete
      const selectQ = `SELECT * FROM ${targetTable} ORDER BY id DESC LIMIT 1`;
      const selectR = await pool.query(selectQ);

      if (selectR.rows.length > 0) {
        oldData = selectR.rows[0];
        query = `DELETE FROM ${targetTable} WHERE id = $1 RETURNING *`;
        params = [oldData.id];
        const r = await pool.query(query, params);
        dbResult = r.rows[0];
      } else {
        return res.status(404).json({ error: 'No data found to modify' });
      }

    } else if (['GET', 'PULL'].includes(action)) {
      // Just fetch data
      query = `SELECT * FROM ${targetTable} ORDER BY id DESC LIMIT 1`;
      const r = await pool.query(query);
      dbResult = r.rows[0] || { message: 'No data found' };
    }

    // 2. Manual Notification
    const notifPayload = JSON.stringify({
      operation: action,
      table: targetTable,
      data: dbResult,
      old_data: oldData // Populated for PUT/PATCH/DELETE
    });

    await pool.query(`SELECT pg_notify('table_changes', $1)`, [notifPayload]);

    res.json({
      ...dbResult,
      _table: targetTable,
      _action: action,
      _headers: req.headers,
      _ip: req.ip
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
