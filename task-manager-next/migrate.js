require('dotenv').config();
const { initializeDatabase } = require('./database.js');

async function migrate() {
    try {
        await initializeDatabase();
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
