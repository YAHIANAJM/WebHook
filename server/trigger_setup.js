const axios = require('axios');

async function setup() {
    try {
        await axios.post('http://localhost:3000/setup-db');
        console.log('Database setup successful');
    } catch (err) {
        console.error('Setup failed:', err.message);
    }
}

setup();
