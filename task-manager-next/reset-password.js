require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function resetPassword() {
    try {
        const email = 'admin@taskmanager.com';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log(`Resetting password for ${email} to ${password}...`);

        const result = await pool.query(
            'UPDATE users SET password = $1 WHERE email = $2 RETURNING *',
            [hashedPassword, email]
        );

        if (result.rows.length > 0) {
            console.log('✅ Password updated successfully!');
            console.log('User:', result.rows[0].email);
        } else {
            console.log('❌ User not found!');
            // Create if not exists?
            console.log('Creating user...');
            await pool.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
                ['Admin User', email, hashedPassword, 'admin']
            );
            console.log('✅ User created successfully!');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

resetPassword();
