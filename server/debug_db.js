const { Pool } = require('pg');
const dotenv = require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
};

const pool = new Pool(dbConfig);

async function checkWebhooks() {
    try {
        const res = await pool.query('SELECT * FROM webhooks');
        console.log('--- Current Webhooks Table Content ---');
        console.table(res.rows);

        // Check listener tables too just in case
        const lRes = await pool.query('SELECT * FROM webhook_listeners');
        console.log('--- Current Listeners ---');
        console.table(lRes.rows);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkWebhooks();
