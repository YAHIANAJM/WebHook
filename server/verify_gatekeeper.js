const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyGatekeeper() {
    try {
        console.log('--- Testing Gatekeeper Middleware ---');

        // 1. Create a "Bad" Gatekeeper (Invalid URL)
        // GLOBAL (table_name: null) + Active = Gatekeeper Middleware
        console.log('1. Registering Blocking Webhook (Bad URL)...');
        const badRes = await axios.post(`${API_URL}/webhooks`, {
            url: 'http://localhost:9999/bad-gatekeeper',
            events: ['ALL'], // Standard event, but GLOBAL scope makes it a blocker
            table_name: null,
            target_column: null
        });
        const badId = badRes.data.id;

        // 2. Try Request - Should Fail
        console.log('2. sending generic request (Should get BLOCKED)...');
        try {
            await axios.post(`${API_URL}/login`, { email: 'admin@test.com', password: '123456' });
            console.error('   ❌ FAILED: Login succeeded (Should have been blocked)');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('   ✅ SUCCESS: Login was blocked (403 Forbidden)');
            } else {
                console.error(`   ❌ FAILED: Unexpected error ${err.message}`);
            }
        }

        // 3. Delete Bad Webhook
        await axios.delete(`${API_URL}/webhooks/${badId}`);

        // 4. Create "Good" Gatekeeper (Valid URL)
        // We point it to our own existing listener trigger
        const listener = (await axios.get(`${API_URL}/api/listeners`)).data[0];

        console.log(`4. Registering Allowing Webhook (${listener.uuid})...`);
        const goodRes = await axios.post(`${API_URL}/webhooks`, {
            url: `${API_URL}/api/listeners/${listener.uuid}/trigger`,
            events: ['POST'],
            table_name: null,
            target_column: null
        });

        // 5. Try Request - Should Succeed
        console.log('5. sending generic request (Should PASS)...');
        try {
            await axios.post(`${API_URL}/login`, { email: 'admin@test.com', password: '123456' });
            console.log('   ✅ SUCCESS: Login passed (200 OK)');
        } catch (err) {
            console.error(`   ❌ FAILED: Request blocked unexpectedly: ${err.message}`);
        }

        // Cleanup
        await axios.delete(`${API_URL}/webhooks/${goodRes.data.id}`);

    } catch (err) {
        console.error('ERROR:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    }
}

verifyGatekeeper();
