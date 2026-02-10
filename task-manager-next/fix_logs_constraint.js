require('dotenv').config();
const { pool } = require('./database');

async function fixConstraint() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        // Drop the check constraint if it exists.
        // We need to know the name. Usually "project_logs_type_check".
        // Or we can alter the column to drop the check.

        console.log('Dropping check constraint on project_logs.type...');
        await client.query('ALTER TABLE project_logs DROP CONSTRAINT IF EXISTS project_logs_type_check');

        console.log('Constraint dropped successfully.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

fixConstraint();
