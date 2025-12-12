const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyGatekeeper() {
    console.log('--- 🛡️ Gatekeeper V2 Verification ---');
    let badWebhookId, goodWebhookId, listenerId;

    try {
        // 1. Create a Listener for the "Good" test later
        console.log('1. Creating Test Listener...');
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'Gatekeeper Test Listener' });
        const listener = listenerRes.data;
        listenerId = listener.uuid;
        console.log(`   ✅ Listener created: ${listenerId}`);

        // 2. Register BAD Gatekeeper (Global, Bad URL)
        console.log('\n2. Registering Blocking Webhook (Bad URL)...');
        const badRes = await axios.post(`${API_URL}/webhooks`, {
            url: 'http://localhost:9999/bad-gatekeeper',
            events: ['ALL'],
            table_name: null, // Global = Gatekeeper
            target_column: null
        });
        badWebhookId = badRes.data.id;
        console.log(`   ✅ Bad Webhook ID: ${badWebhookId}`);

        // 3. Test Blocked Login
        console.log('\n3. Testing Login (Should be BLOCKED)...');
        try {
            await axios.post(`${API_URL}/login`, { email: 'admin@test.com', password: '123456' });
            console.error('   ❌ FAILED: Login succeeded (Should have been blocked explicitly)');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('   ✅ SUCCESS: Login was blocked (403 Forbidden).');
                console.log(`      Message: ${err.response.data.error}`);
            } else {
                console.error(`   ❌ FAILED: Unexpected error ${err.message}`);
                if (err.response) console.log('      Response:', err.response.status, err.response.data);
            }
        }

        // 4. Delete Bad Webhook
        console.log('\n4. Deleting Bad Webhook...');
        await axios.delete(`${API_URL}/webhooks/${badWebhookId}`);
        badWebhookId = null;

        // 5. Register GOOD Gatekeeper (Global, Valid URL)
        console.log('\n5. Registering Allowing Webhook (Good URL)...');
        const goodRes = await axios.post(`${API_URL}/webhooks`, {
            url: `${API_URL}/api/listeners/${listenerId}/trigger`, // Points to our own listener
            events: ['POST'],
            table_name: null,
            target_column: null
        });
        goodWebhookId = goodRes.data.id;
        console.log(`   ✅ Good Webhook ID: ${goodWebhookId}`);

        // 6. Test Allowed Login
        console.log('\n6. Testing Login (Should PASS)...');
        try {
            const loginRes = await axios.post(`${API_URL}/login`, { email: 'admin@test.com', password: '123456' });
            console.log('   ✅ SUCCESS: Login passed (200 OK).');
            console.log(`      Token: ${loginRes.data.token}`);
        } catch (err) {
            console.error(`   ❌ FAILED: Request blocked unexpectedly: ${err.message}`);
            if (err.response) console.log('      Response:', err.response.status, err.response.data);
        }

    } catch (err) {
        console.error('\n❌ CRITICAL ERROR:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
        }
    } finally {
        // Cleanup
        console.log('\n--- Cleanup ---');
        if (badWebhookId) await axios.delete(`${API_URL}/webhooks/${badWebhookId}`).catch(() => console.log('Failed to cleanup bad webhook'));
        if (goodWebhookId) await axios.delete(`${API_URL}/webhooks/${goodWebhookId}`).catch(() => console.log('Failed to cleanup good webhook'));
        // We leave the listener or could delete it too, but it's fine.
    }
}

verifyGatekeeper();
