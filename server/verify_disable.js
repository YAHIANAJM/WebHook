const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyDisable() {
    try {
        console.log('--- Testing Webhook Disable Logic ---');

        // 1. Create Webhook
        const res = await axios.post(`${API_URL}/webhooks`, {
            url: 'temp_url', // Will be overwritten by createListener logic in UI, but here we manually simulate
            events: ['GATEKEEPER'], // Type doesn't matter for this test
            table_name: null,
            target_column: null
        });
        // Wait, the UI logic couples Listener creation with Webhook creation.
        // We need to replicate that relation:
        // A listener URL: .../api/listeners/UUID/trigger
        // A webhook entry URL: .../api/listeners/UUID/trigger

        // A. Create Listener
        console.log('A. Creating Listener...');
        const listener = (await axios.post(`${API_URL}/api/listeners`, { name: 'Disable Test' })).data;
        const triggerUrl = `${API_URL}/api/listeners/${listener.uuid}/trigger`;

        // B. Create Webhook Entry pointing to it
        console.log('B. Creating Webhook Entry...');
        const webhook = (await axios.post(`${API_URL}/webhooks`, {
            url: triggerUrl,
            events: ['ALL'],
            table_name: null,
            target_column: null
        })).data;

        // C. Test Enabled (Should work)
        console.log('C. Testing Enabled Trigger...');
        try {
            await axios.post(triggerUrl, { data: 'should pass' });
            console.log('   ✅ Enabled request passed.');
        } catch (err) {
            console.error('   ❌ Enabled request FAILED:', err.message);
        }

        // D. Disable It
        console.log('D. Disabling Webhook...');
        await axios.put(`${API_URL}/webhooks/${webhook.id}`, { active: false });

        // E. Test Disabled (Should Fail)
        console.log('E. Testing Disabled Trigger...');
        try {
            await axios.post(triggerUrl, { data: 'should fail' });
            console.error('   ❌ FAILED: Disabled request passed (Should have been 403)');
        } catch (err) {
            if (err.response && err.response.status === 403) {
                console.log('   ✅ Disabled request was blocked (403).');
            } else {
                console.error(`   ❌ FAILED: Unexpected error ${err.message}`);
            }
        }

        // F. Re-enable
        console.log('F. Re-enabling Webhook...');
        await axios.put(`${API_URL}/webhooks/${webhook.id}`, { active: true });

        // G. Test Again
        try {
            await axios.post(triggerUrl, { data: 'should pass again' });
            console.log('   ✅ Re-enabled request passed.');
        } catch (err) {
            console.error('   ❌ Re-enabled request FAILED:', err.message);
        }

        // Cleanup
        await axios.delete(`${API_URL}/webhooks/${webhook.id}`);
        await axios.delete(`${API_URL}/api/listeners/${listener.id}`);

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyDisable();
