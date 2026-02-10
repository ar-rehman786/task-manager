require('dotenv').config();
const { pool } = require('./database');
const bcrypt = require('bcryptjs');

async function debugLogin() {
    const email = 'admin@taskmanager.com';
    const password = 'admin123';

    try {
        console.log(`🔍 Attempting login debug for: ${email}`);

        // 1. Fetch User (Exact query from server.js)
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND active = 1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log('❌ User NOT FOUND or NOT ACTIVE.');
            // Check if they exist but are inactive
            const inactiveCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            if (inactiveCheck.rows.length > 0) {
                console.log('   ⚠️ User exists but active flag is:', inactiveCheck.rows[0].active);
            } else {
                console.log('   ⚠️ User does not exist in the database at all.');
            }
            process.exit(0);
        }

        console.log('✅ User FOUND.');
        console.log('   ID:', user.id);
        console.log('   Role:', user.role);
        console.log('   Stored Hash:', user.password);

        // 2. Compare Password
        console.log(`\n🔑 Comparing password '${password}' with hash...`);
        const validPassword = await bcrypt.compare(password, user.password);

        if (validPassword) {
            console.log('✅ Password VALID. Login should work.');
        } else {
            console.log('❌ Password INVALID.');
            console.log('   (Hash mismatch)');
        }

    } catch (error) {
        console.error('❌ Error during debug:', error);
    } finally {
        process.exit(0);
    }
}

debugLogin();
