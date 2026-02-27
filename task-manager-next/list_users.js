require('dotenv').config();
const { query } = require('./database.js');

async function listUsers() {
    try {
        const result = await query('SELECT id, name, email FROM users LIMIT 10');
        console.log('Users in DB:');
        result.rows.forEach(user => {
            console.log(`- ${user.name} (${user.email})`);
        });
    } catch (err) {
        console.error('Error listing users:', err.message);
    }
    process.exit();
}

listUsers();
