const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyLogDeletion() {
    try {
        console.log('--- Testing Log Deletion ---');

        // 1. Create a dummy log to delete
        // We do this by triggering a webhook
        const listener = (await axios.get(`${API_URL}/api/listeners`)).data[0];
        if (!listener) {
            console.log('No listeners found to test with.');
            return;
        }
        await axios.post(`${API_URL}/api/listeners/${listener.uuid}/trigger`, { data: "trash" });

        // Wait for log
        await new Promise(r => setTimeout(r, 1000));

        // 2. Clear All
        console.log('2. Clearing all logs...');
        const clearRes = await axios.delete(`${API_URL}/api/logs/clear`);
        if (clearRes.status === 200) console.log('   ✅ Clear All Success');
        else console.error('   ❌ Clear All Failed');

        // Verify empty
        const logs = (await axios.get(`${API_URL}/api/logs/all`)).data;
        if (logs.length === 0) console.log('   ✅ Logs are empty');
        else console.error(`   ❌ Logs not empty (${logs.length} found)`);

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyLogDeletion();
