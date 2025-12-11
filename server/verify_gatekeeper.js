const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyGatekeeper() {
    try {
        console.log('--- Testing Gatekeeper Middleware ---');

        // 1. Create a "Bad" Gatekeeper (Invalid URL)
        // This should cause connection error -> Block
        console.log('1. Registering Blocking Webhook (Bad URL)...');
        const badRes = await axios.post(`${API_URL}/webhooks`, {
            url: 'http://localhost:9999/bad-gatekeeper', // Nothing running here
            events: ['GATEKEEPER'],
            table_name: null,
            target_column: null
        });
        const badId = badRes.data.id;

        // 2. Try Request - Should Fail
        console.log('2. sending generic request...');
        try {
            await axios.post(`${API_URL}/test-data`, { name: 'Blocked Item' });
            console.error('   ❌ FAILED: Request appeared to succeed (Should have been blocked)');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('   ✅ SUCCESS: Request was blocked (403 Forbidden)');
            } else {
                console.error(`   ❌ FAILED: Unexpected error ${err.message}`);
            }
        }

        // 3. Delete Bad Webhook
        await axios.delete(`${API_URL}/webhooks/${badId}`);

        // 4. Create "Good" Gatekeeper (Valid URL)
        // We point it to our own existing listener trigger
        const listener = (await axios.get(`${API_URL}/api/listeners`)).data[0];
        if (!listener) throw new Error("No listeners available for good test");

        console.log(`4. Registering Allowing Webhook (${listener.uuid})...`);
        const goodRes = await axios.post(`${API_URL}/webhooks`, {
            url: `${API_URL}/api/listeners/${listener.uuid}/trigger`,
            events: ['GATEKEEPER'],
            table_name: null,
            target_column: null
        });

        // 5. Try Request - Should Succeed
        console.log('5. sending generic request...');
        try {
            await axios.post(`${API_URL}/test-data`, { name: 'Allowed Item' });
            console.log('   ✅ SUCCESS: Request passed (200 OK)');
        } catch (err) {
            console.error(`   ❌ FAILED: Request blocked unexpectedly: ${err.message}`);
        }

        // Cleanup
        await axios.delete(`${API_URL}/webhooks/${goodRes.data.id}`);

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyGatekeeper();
