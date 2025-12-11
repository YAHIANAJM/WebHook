const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function testFlow() {
    try {
        console.log('1. Creating Listener...');
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'Auto Test Listener' });
        const listener = listenerRes.data;
        const webhookUrl = `${API_URL}/api/listeners/${listener.uuid}/trigger`;
        console.log('   Listener created:', webhookUrl);

        console.log('2. Registering Webhook...');
        // Simulating the exact payload from Frontend
        const payload = {
            url: webhookUrl,
            events: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'PULL', 'INSERT', 'UPDATE'],
            table_name: 'test_webhook',
            target_column: null
        };

        const whRes = await axios.post(`${API_URL}/webhooks`, payload);
        const webhook = whRes.data;
        console.log('   Webhook ID:', webhook.id);
        console.log('   Active:', webhook.active);

        console.log('3. Triggering Simulation...');
        const simRes = await axios.post(`${API_URL}/test-data`, {
            name: 'Flow Check',
            table: 'test_webhook',
            action: 'POST'
        });
        console.log('   Simulation result:', simRes.data);

        console.log('4. Waiting for processing...');
        await new Promise(r => setTimeout(r, 2000));

        console.log('5. Checking Listener Logs...');
        const logsRes = await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`);
        const logs = logsRes.data;
        console.log(`   Found ${logs.length} logs.`);
        if (logs.length > 0) {
            console.log('   SUCCESS: Webhook received event!');
        } else {
            console.error('   FAILURE: No logs found!');
        }

    } catch (err) {
        console.error('ERROR:', err.response ? err.response.data : err.message);
    }
}

testFlow();
