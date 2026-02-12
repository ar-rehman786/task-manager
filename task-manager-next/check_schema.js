const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tasks'
        `);
        console.log('--- Tasks Table Columns ---');
        console.log(JSON.stringify(res.rows, null, 2));

        const indexRes = await pool.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'tasks' OR tablename = 'milestones'
        `);
        console.log('--- Indexes ---');
        console.log(JSON.stringify(indexRes.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
