const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyToggle() {
    try {
        console.log('--- Testing Webhook Toggle ---');

        // 1. Create Webhook
        const res = await axios.post(`${API_URL}/webhooks`, {
            url: 'http://test.com',
            events: ['GATEKEEPER'],
            table_name: null,
            target_column: null
        });
        const id = res.data.id;
        console.log(`1. Created Webhook ID ${id}, Active: ${res.data.active}`);

        // 2. Toggle OFF
        console.log('2. Toggling OFF...');
        await axios.put(`${API_URL}/webhooks/${id}`, { active: false });

        // Check DB
        const check1 = (await axios.get(`${API_URL}/webhooks`)).data.find(w => w.id === id);
        console.log(`   Start Active: ${res.data.active} -> End Active: ${check1.active}`);

        if (check1.active === false) {
            console.log('   ✅ Toggled OFF successfully.');
        } else {
            console.error('   ❌ Failed to toggle OFF.');
        }

        // 3. Toggle ON
        console.log('3. Toggling ON...');
        await axios.put(`${API_URL}/webhooks/${id}`, { active: true });
        const check2 = (await axios.get(`${API_URL}/webhooks`)).data.find(w => w.id === id);

        if (check2.active === true) {
            console.log('   ✅ Toggled ON successfully.');
        } else {
            console.error('   ❌ Failed to toggle ON.');
        }

        // Cleanup
        await axios.delete(`${API_URL}/webhooks/${id}`);

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyToggle();
