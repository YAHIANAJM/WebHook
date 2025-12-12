const axios = require('axios');
const API_URL = 'http://localhost:3000';

async function verifyBodyCapture() {
    try {
        console.log('--- Testing Body Capture ---');

        // 1. Get Listener
        const listeners = (await axios.get(`${API_URL}/api/listeners`)).data;
        if (listeners.length === 0) {
            console.log('No listeners found to test.');
            return;
        }
        const listener = listeners[0];
        const url = `${API_URL}/api/listeners/${listener.uuid}/trigger`;

        console.log(`Using Listener: ${url}`);

        // A. JSON Test
        console.log('A. Testing JSON...');
        await axios.post(url, { type: 'json', value: 123 });
        await new Promise(r => setTimeout(r, 500));
        let logs = (await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`)).data;
        console.log(`   JSON Log Body:`, typeof logs[0].body, logs[0].body);

        // B. Form Data Test
        console.log('B. Testing Form Data...');
        await axios.post(url, 'type=form&value=456', {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        await new Promise(r => setTimeout(r, 500));
        logs = (await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`)).data;
        console.log(`   Form Log Body:`, typeof logs[0].body, logs[0].body);

        // C. Text Test
        console.log('C. Testing Raw Text...');
        await axios.post(url, 'Just some raw text payload', {
            headers: { 'Content-Type': 'text/plain' }
        });
        await new Promise(r => setTimeout(r, 500));
        logs = (await axios.get(`${API_URL}/api/listeners/${listener.id}/logs`)).data;
        console.log(`   Text Log Body:`, typeof logs[0].body, logs[0].body);

    } catch (err) {
        console.error('ERROR:', err.message);
    }
}

verifyBodyCapture();
