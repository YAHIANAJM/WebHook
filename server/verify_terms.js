const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyEvents() {
    try {
        console.log('--- Starting Event Term Verification ---');

        // 1. Create a Listener
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'Term Test Listener' });
        const triggerUrl = `${API_URL}/api/listeners/${listenerRes.data.uuid}/trigger`;

        // 2. Register for "Inserting" (INSERT, POST)
        const whRes = await axios.post(`${API_URL}/webhooks`, {
            url: triggerUrl,
            events: ['INSERT', 'POST'],
            table_name: 'test_webhook',
            target_column: null
        });
        console.log(`2. Registered for INSERT/POST (ID: ${whRes.data.id})`);

        // 3. Trigger POST (Should work)
        console.log('3. Sending POST...');
        await axios.post(`${API_URL}/test-data`, {
            name: 'Post Item',
            table: 'test_webhook',
            action: 'POST'
        });
        await new Promise(r => setTimeout(r, 1000));
        let logs = (await axios.get(`${API_URL}/api/listeners/${listenerRes.data.id}/logs`)).data;
        if (logs.length > 0) console.log('   ✅ POST Triggered success');
        else console.error('   ❌ POST Failed');

        // 4. Trigger PUT (Should FAIL)
        console.log('4. Sending PUT (Should be ignored)...');
        await axios.post(`${API_URL}/test-data`, {
            name: 'Put Item',
            table: 'test_webhook',
            action: 'PUT'
        });
        await new Promise(r => setTimeout(r, 1000));
        logs = (await axios.get(`${API_URL}/api/listeners/${listenerRes.data.id}/logs`)).data;
        // Should still be 1 log
        if (logs.length === 1) console.log('   ✅ PUT Ignored success');
        else console.error(`   ❌ PUT Triggered (Logs: ${logs.length})`);

        // 5. Cleanup & Register for ALL
        await axios.delete(`${API_URL}/webhooks/${whRes.data.id}`);
        // server/index.js defines generic eventsList somewhat implicitly via logic, 
        // but let's send a full list to imitate "ALL"
        const allEvents = ['INSERT', 'UPDATE', 'DELETE', 'POST', 'PUT', 'PATCH', 'GET', 'PULL'];

        await axios.post(`${API_URL}/webhooks`, {
            url: triggerUrl,
            events: allEvents,
            table_name: 'test_webhook',
            target_column: null
        });
        console.log('5. Registered for ALL events');

        // 6. Trigger GET (Should work if logic holds)
        console.log('6. Sending GET...');
        await axios.post(`${API_URL}/test-data`, {
            name: 'Get Item',
            table: 'test_webhook',
            action: 'GET'
        });
        await new Promise(r => setTimeout(r, 1000));
        logs = (await axios.get(`${API_URL}/api/listeners/${listenerRes.data.id}/logs`)).data;
        // Start count depends on flush, let's just check if count increased
        const finalCount = logs.length;
        if (finalCount > 1) console.log('   ✅ GET Triggered success (All Events works)');
        else console.error('   ❌ GET Failed');

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyEvents();
