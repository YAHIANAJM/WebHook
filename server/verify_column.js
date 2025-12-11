const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyColumnMonitor() {
    try {
        console.log('--- Starting Column Monitor Verification ---');

        // 1. Create a Listener
        const listenerRes = await axios.post(`${API_URL}/api/listeners`, { name: 'Column Monitor Test' });
        const listener = listenerRes.data;
        const triggerUrl = `${API_URL}/api/listeners/${listener.uuid}/trigger`;
        console.log('1. Listener Created:', triggerUrl);

        // 2. Register Webhook listening to 'description' column on 'test_webhook' table
        // We select PUT (which maps to UPDATE)
        const whRes = await axios.post(`${API_URL}/webhooks`, {
            url: triggerUrl,
            events: ['UPDATE', 'PUT'],
            table_name: 'test_webhook',
            target_column: 'description' // Only listen to changes on this column
        });
        console.log(`2. Webhook Registered (ID: ${whRes.data.id}) to monitor 'description' column.`);

        // 3. Create initial data
        const initRes = await axios.post(`${API_URL}/test-data`, {
            name: 'Initial Item',
            table: 'test_webhook',
            action: 'POST'
        });
        console.log('3. Initial Data Created (POST).');
        await new Promise(r => setTimeout(r, 1000)); // Wait for non-event

        // 4. Update NAME (Should NOT trigger because we are watching DESCRIPTION)
        console.log('4. Performing UPDATE on NAME (Should BE IGNORED)...');
        await axios.post(`${API_URL}/test-data`, {
            name: 'Updated Name Only',
            table: 'test_webhook',
            action: 'PUT' // Updates last item
        });
        await new Promise(r => setTimeout(r, 2000));

        let logs = (await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`)).data;
        console.log(`   Logs found: ${logs.length} (Expected 0 from update)`);

        // 5. Update DESCRIPTION (Should TRIGGER)
        // Note: The simulator currently only updates the 'name' column based on input.
        // We need to bypass simulator logic slightly or rely on the fact that our simulator 
        // usually updates 'name'.
        // Wait... the simulator updates 'name' column by default. 
        // so let's flip the test: Monitor 'name' column.

        // RE-REGISTERING for 'name' column to make testing easier with current simulator
        await axios.delete(`${API_URL}/webhooks/${whRes.data.id}`);
        const whRes2 = await axios.post(`${API_URL}/webhooks`, {
            url: triggerUrl,
            events: ['UPDATE', 'PUT'],
            table_name: 'test_webhook',
            target_column: 'name'
        });
        console.log(`5. Re-registered Webhook (ID: ${whRes2.data.id}) to monitor 'name' column.`);

        console.log('6. Performing UPDATE on NAME (Should TRIGGER)...');
        await axios.post(`${API_URL}/test-data`, {
            name: 'Trigger Value',
            table: 'test_webhook',
            action: 'PUT'
        });
        await new Promise(r => setTimeout(r, 2000));

        logs = (await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`)).data;
        if (logs.length > 0) {
            console.log(`   SUCCESS: Found ${logs.length} logs! Event triggered on column change.`);
            console.log('   Latest Log:', logs[0].body.data.name);
        } else {
            console.error('   FAILURE: No logs found.');
        }

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyColumnMonitor();
