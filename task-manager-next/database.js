// MOCK DATABASE IMPLEMENTATION
// Used when real database is unavailable to allow frontend development

const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('dummy');

let pool;
let query;
let initializeDatabase;

if (isMock) {
  console.log('⚠️ RUNNING IN MOCK DATABASE MODE');
  
  pool = {
    on: () => {},
    connect: () => Promise.resolve({
      query: () => Promise.resolve({ rows: [] }),
      release: () => {}
    }),
    query: (text, params) => {
      console.log(`[MOCK DB] Query: ${text.substring(0, 50)}...`);
      return Promise.resolve({ rows: [] });
    }
  };

  query = (text, params) => {
    // Return mock admin user for user queries
    if (text.includes('FROM users') && (text.includes('WHERE email') || text.includes('WHERE id'))) {
        return Promise.resolve({
            rows: [{
                id: 1,
                name: 'Demo Admin',
                email: 'admin@sloraai.com',
                password: '$2a$10$MockPasswordHashForAdmin123', // Mock hash
                role: 'admin',
                active: 1
            }]
        });
    }
    console.log(`[MOCK DB] Query: ${text.substring(0, 50)}...`);
    return Promise.resolve({ rows: [] });
  };

  initializeDatabase = async () => {
    console.log('✅ Mock Database "initialized"');
  };

} else {
  // REAL DATABASE IMPLEMENTATION
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
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000 // 5 seconds timeout
  });

  pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
  });

  query = (text, params) => pool.query(text, params);

  // Initialize database schema
  initializeDatabase = async () => {
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
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        title TEXT,
        department TEXT,
        location TEXT,
        phone TEXT,
        "employeeId" TEXT,
        "profilePicture" TEXT,
        "coverImage" TEXT,
        "managerId" INTEGER REFERENCES users(id) ON DELETE SET NULL
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

      -- Clients table for attendance tracking
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'on_hold', 'completed', 'archived')),
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
        "clientId" INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        "clockInTime" TIMESTAMP NOT NULL,
        "clockOutTime" TIMESTAMP,
        "workDuration" INTEGER,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed')),
        notes TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Project files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_files (
        id SERIAL PRIMARY KEY,
        "projectId" INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        "uploadedBy" INTEGER NOT NULL REFERENCES users(id),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        "isRead" INTEGER DEFAULT 0,
        data JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ideation boards table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ideation_boards (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        "projectId" INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        type TEXT NOT NULL DEFAULT 'mindmap' CHECK(type IN ('mindmap', 'stickies')),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Team chat messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        "readBy" JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Outreach tables — drop and recreate to fix column naming issues
    await client.query(`DROP TABLE IF EXISTS daily_call_reports CASCADE`);
    await client.query(`DROP TABLE IF EXISTS appointments CASCADE`);
    await client.query(`DROP TABLE IF EXISTS closed_deals CASCADE`);

    // Daily call reports table
    await client.query(`
      CREATE TABLE daily_call_reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        report_date DATE NOT NULL,
        calls_made INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Appointments table
    await client.query(`
      CREATE TABLE appointments (
        id SERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        appointment_date TIMESTAMP NOT NULL,
        assigned_closer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'completed', 'no_show')),
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Closed deals table
    await client.query(`
      CREATE TABLE closed_deals (
        id SERIAL PRIMARY KEY,
        business_name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        package_sold TEXT NOT NULL CHECK(package_sold IN ('Starter $297', 'Pro $597', 'Full AI $997')),
        monthly_plan TEXT NOT NULL CHECK(monthly_plan IN ('$97/mo', '$197/mo', '$397/mo')),
        notes TEXT,
        closed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_daily_reports_user ON daily_call_reports(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_call_reports(report_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_closer ON appointments(assigned_closer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_created_by ON appointments(created_by)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_closed_deals_closed_by ON closed_deals(closed_by)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks("assignedUserId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks("milestoneId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks("projectId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones("projectId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards("ownerUserId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance("userId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_clockin ON attendance("clockInTime")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications("userId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications("isRead")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_logs_project ON project_logs("projectId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_project_access_project ON project_access_items("projectId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ideation_project ON ideation_boards("projectId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ideation_user ON ideation_boards("userId")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages("createdAt")');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages("userId")');

    // Schema Updates (Safe to run multiple times)
    // Add projectId and milestoneId to tasks
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='projectId') THEN
          ALTER TABLE tasks ADD COLUMN "projectId" INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='milestoneId') THEN
          ALTER TABLE tasks ADD COLUMN "milestoneId" INTEGER REFERENCES milestones(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='loomVideo') THEN
          ALTER TABLE tasks ADD COLUMN "loomVideo" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='workflowLink') THEN
          ALTER TABLE tasks ADD COLUMN "workflowLink" TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='workflowStatus') THEN
          ALTER TABLE tasks ADD COLUMN "workflowStatus" TEXT;
        END IF;
      END
      $$;
    `);

    // Add managerId and assignedUserId to projects
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='managerId') THEN
          ALTER TABLE projects ADD COLUMN "managerId" INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='assignedUserId') THEN
          ALTER TABLE projects ADD COLUMN "assignedUserId" INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);

    // Update projects status CHECK constraint
    await client.query(`
      DO $$
      BEGIN
        -- Drop old constraint if exists
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
        -- Add new one with more statuses
        ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('active', 'paused', 'closed', 'waiting_for_client_response', 'on_hold', 'completed', 'archived'));
      END
      $$;
    `);

    // Add profile columns to users (Schema Migration)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='title') THEN
          ALTER TABLE users ADD COLUMN title TEXT;
          ALTER TABLE users ADD COLUMN department TEXT;
          ALTER TABLE users ADD COLUMN location TEXT;
          ALTER TABLE users ADD COLUMN phone TEXT;
          ALTER TABLE users ADD COLUMN "employeeId" TEXT;
          ALTER TABLE users ADD COLUMN "profilePicture" TEXT;
          ALTER TABLE users ADD COLUMN "coverImage" TEXT;
          ALTER TABLE users ADD COLUMN "managerId" INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        -- Ensure attendance table has clientId (migration)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='clientId') THEN
          ALTER TABLE attendance ADD COLUMN "clientId" INTEGER REFERENCES clients(id) ON DELETE SET NULL;
        END IF;

        -- Drop existing FK if it's there (since we're using it for projects now)
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_clientId_fkey') THEN
          ALTER TABLE attendance DROP CONSTRAINT "attendance_clientId_fkey";
        END IF;

        -- Seed initial clients if empty
        IF (SELECT count(*) FROM clients) = 0 THEN
          INSERT INTO clients (name) VALUES ('Internal Work'), ('Client Alpha'), ('Project X'), ('Global Solutions');
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
  };
}

module.exports = {
  query,
  pool,
  initializeDatabase
};
