const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyFailClosed() {
    console.log('--- 🛡️ Gatekeeper Fail-Closed Verification ---');
    let webhookId, listenerId;

    try {
        // 1. Create Helper Listener (so we have a valid URL)
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'FailClosed Test' });
        listenerId = listenerRes.data.uuid;
        const validUrl = `${API_URL}/api/listeners/${listenerId}/trigger`;

        // 2. Register GLOBAL Webhook (Active)
        console.log('\n1. Registering Active Global Webhook...');
        const whRes = await axios.post(`${API_URL}/webhooks`, {
            url: validUrl,
            events: ['POST'],
            table_name: null, // Global
            target_column: null
        });
        webhookId = whRes.data.id;

        // 3. Test active (Should Pass)
        console.log('   Testing Login (Expect: PASS)...');
        await axios.post(`${API_URL}/login`, { email: 'admin@test.com', password: '123456' });
        console.log('   ✅ Active Login Passed.');

        // 4. Disable Webhook
        console.log('\n2. Disabling Webhook...');
        await axios.put(`${API_URL}/webhooks/${webhookId}`, { active: false });

        // 5. Test Inactive (Should BLOCK)
        console.log('   Testing Login (Expect: BLOCK)...');
        try {
            await axios.post(`${API_URL}/login`, { email: 'admin@test.com', password: '123456' });
            console.error('   ❌ FAILED: Login succeeded (Disabled Webhook should have blocked it)');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('   ✅ SUCCESS: Login was blocked (403).');
                console.log(`      Error: ${err.response.data.error}`); // Expected: Request blocked by middleware webhook
                console.log(`      Details: ${err.response.data.details}`); // Expected: Webhook ID is disabled...
            } else {
                console.error(`   ❌ FAILED: Unexpected error ${err.message}`);
            }
        }

    } catch (err) {
        console.error('CRITICAL ERROR:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    } finally {
        if (webhookId) await axios.delete(`${API_URL}/webhooks/${webhookId}`);
        // Listener cleanup skipped (auto-cleaned in real db or ignored)
    }
}

verifyFailClosed();
