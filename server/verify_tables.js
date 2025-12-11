const axios = require('axios');

async function checkTables() {
    try {
        const res = await axios.get('http://localhost:3000/tables');
        const tables = res.data;
        console.log('Available Tables:', tables);

        const internal = ['webhooks', 'webhook_listeners', 'listener_logs'];
        const leaks = tables.filter(t => internal.includes(t));

        if (leaks.length > 0) {
            console.error('❌ Failed! Found internal tables:', leaks);
        } else {
            console.log('✅ Success! Internal tables are hidden.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkTables();
