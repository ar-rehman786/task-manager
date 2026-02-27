require('dotenv').config();
const { query } = require('./database.js');

async function checkData() {
    console.log('Starting data check...');
    try {
        console.log('Connecting to database...');
        const users = await query('SELECT COUNT(*) FROM users');
        const tasks = await query('SELECT COUNT(*) FROM tasks');
        const attendance = await query('SELECT COUNT(*) FROM attendance');
        const projects = await query('SELECT COUNT(*) FROM projects');

        console.log('Database Stats:');
        console.log(`- Users: ${users.rows[0].count}`);
        console.log(`- Tasks: ${tasks.rows[0].count}`);
        console.log(`- Attendance: ${attendance.rows[0].count}`);
        console.log(`- Projects: ${projects.rows[0].count}`);
    } catch (err) {
        console.error('Error checking data:', err.message);
        console.error(err.stack);
    }
    process.exit();
}

checkData();
