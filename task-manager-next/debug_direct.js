require('dotenv').config();
const { Client } = require('pg');

async function debugDirect() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to DB');

        const boards = await client.query('SELECT b.*, u.role as "ownerRole" FROM boards b LEFT JOIN users u ON b."ownerUserId" = u.id');
        console.log('--- ALL Boards ---');
        console.log(JSON.stringify(boards.rows, null, 2));

        const users = await client.query('SELECT id, name, email, role FROM users');
        console.log('--- ALL Users ---');
        console.log(JSON.stringify(users.rows, null, 2));
    } catch (err) {
        console.error('❌ Direct Debug Error:', err);
    } finally {
        await client.end();
        process.exit();
    }
}

debugDirect();
