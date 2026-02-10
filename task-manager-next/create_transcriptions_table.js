const { Pool } = require('pg');
require('dotenv').config(); // Load .env by default

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function createTranscriptionsTable() {
    try {
        console.log('Connecting to database...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_transcriptions (
                id SERIAL PRIMARY KEY,
                "projectId" INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                "createdBy" INTEGER REFERENCES users(id),
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ project_transcriptions table created successfully');

        await pool.query('CREATE INDEX IF NOT EXISTS idx_transcriptions_project ON project_transcriptions("projectId")');
        console.log('✅ Index created');

    } catch (error) {
        console.error('❌ Error creating table:', error);
    } finally {
        pool.end();
    }
}

createTranscriptionsTable();
