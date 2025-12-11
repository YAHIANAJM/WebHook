const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
});

async function migrate() {
    try {
        await client.connect();
        console.log('Adding target_column to webhooks table...');
        await client.query(`
      ALTER TABLE webhooks 
      ADD COLUMN IF NOT EXISTS target_column TEXT;
    `);
        console.log('Migration successful.');
        await client.end();
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
