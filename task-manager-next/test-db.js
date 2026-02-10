require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

console.log('Testing database connection...');
console.log('URL Length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'N/A');

client.connect()
    .then(() => {
        console.log('✅ Connection Successful!');
        return client.query('SELECT NOW()');
    })
    .then((res) => {
        console.log('✅ Query Result:', res.rows[0]);
        client.end();
    })
    .catch((err) => {
        console.error('❌ Connection Failed:', err);
        console.error('Error Details:', JSON.stringify(err, null, 2));
        if (err.parent || err.original) console.error('Parent Error:', err.parent || err.original);
        client.end();
    });
