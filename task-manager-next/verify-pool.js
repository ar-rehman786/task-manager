require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

console.log('Testing Pool connection...');

(async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Pool connected successfully');
        const res = await client.query('SELECT NOW()');
        console.log('✅ Query result:', res.rows[0]);
        client.release();
    } catch (err) {
        console.error('❌ Pool connection failed:', err);
    } finally {
        await pool.end();
    }
})();
