const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function runVerification() {
    try {
        console.log('1. Setting up DB...');
        await axios.post(`${API_URL}/setup-db`);

        console.log('2. Creating Local Listener...');
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'Verification Listener' });
        const listener = listenerRes.data;
        const listenerUrl = `${API_URL}/api/listeners/${listener.uuid}/trigger`;
        console.log('   -> Listener Created:', listenerUrl);

        console.log('3. Registering Webhook...');
        const webhookRes = await axios.post(`${API_URL}/webhooks`, {
            url: listenerUrl,
            events: ['POST', 'INSERT'],
            table_name: 'test_webhook', // specific table
            target_column: null
        });
        const webhook = webhookRes.data;
        console.log('   -> Webhook Registered ID:', webhook.id);

        console.log('4. Triggering Event (INSERT into test_webhook)...');
        // We use the test-data endpoint which inserts into test_webhook
        const triggerRes = await axios.post(`${API_URL}/test-data`, {
            name: 'Auto Verify ' + Date.now(),
            table: 'test_webhook',
            action: 'INSERT'
        });
        console.log('   -> Event Triggered:', triggerRes.data);

        console.log('5. Waiting for Async Webhook delivery (3s)...');
        await new Promise(r => setTimeout(r, 3000));

        console.log('6. Checking Listener Logs...');
        const logsRes = await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`);
        const logs = logsRes.data;

        if (logs.length > 0) {
            console.log('   -> SUCCESS: Log found!');
            console.log('   -> Method:', logs[0].method);
            console.log('   -> Body:', JSON.stringify(logs[0].body, null, 2));
        } else {
            console.error('   -> FAILURE: No logs found.');
            process.exit(1);
        }

        console.log('7. Cleanup...');
        await axios.delete(`${API_URL}/webhooks/${webhook.id}`);
        await axios.delete(`${API_URL}/api/listeners/${listener.id}`);
        console.log('   -> Cleanup Complete.');

    } catch (err) {
        console.error('VERIFICATION FAILED:', err.message);
        if (err.response) {
            console.error('Response:', err.response.data);
        }
        process.exit(1);
    }
}

runVerification();
