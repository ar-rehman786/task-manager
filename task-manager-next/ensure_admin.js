require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function ensureAdmin() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        const email = 'admin@example.com';
        const password = 'admin';
        const hashedPassword = await bcrypt.hash(password, 10);

        // check if user exists
        const check = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (check.rows.length > 0) {
            console.log('User already exists. Updating role to admin and resetting password...');
            await client.query('UPDATE users SET role = $1, password = $2, active = 1 WHERE email = $3', ['admin', hashedPassword, email]);
            console.log('Updated existing user.');
        } else {
            console.log('Creating new admin user...');
            const res = await client.query(`
                INSERT INTO users (name, email, password, role, active)
                VALUES ($1, $2, $3, $4, 1) RETURNING id
            `, ['System Admin', email, hashedPassword, 'admin']);

            const userId = res.rows[0].id;
            // Also create a board for them
            await client.query(
                'INSERT INTO boards (workspace, name, type, "ownerUserId") VALUES ($1, $2, $3, $4)',
                ['tasks', 'Admin Board', 'MEMBER_BOARD', userId]
            );
            console.log('Created new user.');
        }

        console.log('Admin user ready.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

ensureAdmin();
