const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function addAssignedUserToProjects() {
    try {
        console.log('Connecting to database...');

        // Add assignedUserId column
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='assignedUserId') THEN
                    ALTER TABLE projects ADD COLUMN "assignedUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL;
                    RAISE NOTICE 'Added assignedUserId column to projects table';
                ELSE
                    RAISE NOTICE 'assignedUserId column already exists';
                END IF;
            END
            $$;
        `);

        // Create index
        await pool.query('CREATE INDEX IF NOT EXISTS idx_projects_assigned ON projects("assignedUserId")');
        console.log('✅ assignedUserId column added and indexed');

    } catch (error) {
        console.error('❌ Error updating database:', error);
    } finally {
        pool.end();
    }
}

addAssignedUserToProjects();
