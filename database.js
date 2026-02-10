const { Pool } = require('pg');

// Debug connection (Safe logging)
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ CRITICAL: DATABASE_URL is undefined or empty!');
} else {
  console.log(`ℹ️ DATABASE_URL detected. Length: ${dbUrl.length}`);
  console.log(`ℹ️ Starts with: ${dbUrl.substring(0, 15)}...`);
}

// Create a new pool using the connection string (from environment variable)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔄 Initializing database schema...');

    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
        active INTEGER DEFAULT 1,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Session table (connect-pg-simple)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
      WITH (OIDS=FALSE);

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);

    // Boards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id SERIAL PRIMARY KEY,
        workspace TEXT NOT NULL CHECK(workspace IN ('tasks', 'projects')),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('ALL_TASKS', 'MEMBER_BOARD')),
        "ownerUserId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'blocked', 'done')),
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
        "dueDate" DATE,
        "assignedUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
        "createdBy" INTEGER NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        labels TEXT
      );
    `);

    // Task activity log
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_activity (
        id SERIAL PRIMARY KEY,
        "taskId" INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        "createdBy" INTEGER NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        client TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'on_hold', 'completed')),
        "startDate" DATE,
        "endDate" DATE,
        description TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Milestones table
    await client.query(`
      CREATE TABLE IF NOT EXISTS milestones (
        id SERIAL PRIMARY KEY,
        "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        "dueDate" DATE,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'done')),
        details TEXT,
        "orderIndex" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Milestone checklist items
    await client.query(`
      CREATE TABLE IF NOT EXISTS milestone_checklist_items (
        id SERIAL PRIMARY KEY,
        "milestoneId" INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        "isDone" INTEGER DEFAULT 0,
        "orderIndex" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Project progress logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_logs (
        id SERIAL PRIMARY KEY,
        "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('done', 'not_done', 'blocker')),
        message TEXT NOT NULL,
        "createdBy" INTEGER NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Project access items
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_access_items (
        id SERIAL PRIMARY KEY,
        "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        description TEXT,
        "isGranted" INTEGER DEFAULT 0,
        "requestedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "grantedAt" TIMESTAMP,
        "grantedEmail" TEXT,
        notes TEXT
      );
    `);

    // Attendance tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "clockInTime" TIMESTAMP NOT NULL,
        "clockOutTime" TIMESTAMP,
        "workDuration" INTEGER,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed')),
        notes TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks("assignedUserId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards("ownerUserId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance("userId")');

    // Schema Updates (Safe to run multiple times)
    // Add projectId to tasks
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='projectId') THEN
          ALTER TABLE tasks ADD COLUMN "projectId" INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    // Add managerId to projects
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='managerId') THEN
          ALTER TABLE projects ADD COLUMN "managerId" INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    await client.query('COMMIT');
    console.log('✅ Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper query function
const query = (text, params) => pool.query(text, params);

module.exports = {
  query,
  pool,
  initializeDatabase
};
