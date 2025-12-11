const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyGenericWebhook() {
    try {
        console.log('--- Testing Generic Webhook Payload ---');

        // 1. Create a Listener
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'Generic Test' });
        const triggerUrl = `${API_URL}/api/listeners/${listenerRes.data.uuid}/trigger`;
        console.log(`1. Created Listener: ${triggerUrl}`);

        // 2. Register Webhook (Global Wildcard style essentially, via URL hit)
        // Note: The user just hits the URL. Registration is for outgoing.
        // We are testing incoming.

        // 3. Send Generic Payload
        const payload = { data: "dayata", status: "success", random: Math.random() };
        console.log('3. Sending Payload:', payload);
        await axios.post(triggerUrl, payload);

        // 4. Check Logs
        await new Promise(r => setTimeout(r, 1000));
        const logsRes = await axios.get(`${API_URL}/api/logs/all`);
        const recentLog = logsRes.data.find(l => l.listener_id === listenerRes.data.id);

        if (recentLog) {
            console.log('4. Log Found in DB!');
            console.log('   Raw Body in DB:', recentLog.body);
            // Verify it parses back to our object
            const parsed = JSON.parse(recentLog.body);
            if (parsed.data === "dayata") {
                console.log('   ✅ Validated content matches.');
            } else {
                console.error('   ❌ Content mismatch.');
            }
        } else {
            console.error('   ❌ Log NOT found.');
        }

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyGenericWebhook();
