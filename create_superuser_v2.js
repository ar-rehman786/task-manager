require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function createSuperUser() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        const email = 'abdulrehmanhameed4321@gmail.com';
        const password = '()()()()';
        const hashedPassword = await bcrypt.hash(password, 10);

        // check if user exists
        const check = await client.query('SELECT * FROM users WHERE email = $1', [email]);

        if (check.rows.length > 0) {
            console.log('User already exists. Updating role to admin...');
            await client.query('UPDATE users SET role = $1, password = $2, active = 1 WHERE email = $3', ['admin', hashedPassword, email]);
        } else {
            console.log('Creating new super user...');
            // Need to handle the case where "role" column might not exist or constraint issues? 
            // The schema has "role" text check in ('admin', 'member').
            await client.query(`
                INSERT INTO users (name, email, password, role)
                VALUES ($1, $2, $3, $4)
            `, ['Super Admin', email, hashedPassword, 'admin']);

            // Also create a board for them just in case logic relies on it
            const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            const userId = userRes.rows[0].id;
            await client.query(
                'INSERT INTO boards (workspace, name, type, "ownerUserId") VALUES ($1, $2, $3, $4)',
                ['tasks', 'Super Admin Board', 'MEMBER_BOARD', userId]
            );
        }

        console.log('Super user created successfully.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        pool.end(); // Close the pool to exit the script
    }
}

createSuperUser();
