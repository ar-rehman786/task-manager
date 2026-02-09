const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'taskmanager.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'member')),
      active INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Boards table (ALL_TASKS or MEMBER_BOARD)
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace TEXT NOT NULL CHECK(workspace IN ('tasks', 'projects')),
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ALL_TASKS', 'MEMBER_BOARD')),
      ownerUserId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ownerUserId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'blocked', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      dueDate DATE,
      assignedUserId INTEGER,
      createdBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      labels TEXT,
      FOREIGN KEY (assignedUserId) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  // Task activity log
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId INTEGER NOT NULL,
      message TEXT NOT NULL,
      createdBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'on_hold', 'completed')),
      startDate DATE,
      endDate DATE,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Milestones table
  db.exec(`
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      title TEXT NOT NULL,
      dueDate DATE,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'done')),
      details TEXT,
      orderIndex INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Milestone checklist items
  db.exec(`
    CREATE TABLE IF NOT EXISTS milestone_checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milestoneId INTEGER NOT NULL,
      text TEXT NOT NULL,
      isDone INTEGER DEFAULT 0,
      orderIndex INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (milestoneId) REFERENCES milestones(id) ON DELETE CASCADE
    )
  `);

  // Project progress logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('done', 'not_done', 'blocker')),
      message TEXT NOT NULL,
      createdBy INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES users(id)
    )
  `);

  // Project access items (client access requirements)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_access_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      platform TEXT NOT NULL,
      description TEXT,
      isGranted INTEGER DEFAULT 0,
      requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      grantedAt DATETIME,
      grantedEmail TEXT,
      notes TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Attendance tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      clockInTime DATETIME NOT NULL,
      clockOutTime DATETIME,
      workDuration INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assignedUserId);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(createdAt);
    CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(ownerUserId);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(projectId);
    CREATE INDEX IF NOT EXISTS idx_access_items_project ON project_access_items(projectId);
    CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(userId);
    CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
  `);

  console.log('✅ Database initialized successfully');
}

module.exports = { db, initializeDatabase };
