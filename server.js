const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const { db, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initializeDatabase();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));



app.use(session({
    secret: 'task-manager-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ error: 'Forbidden - Admin only' });
    }
    next();
}

// ============= AUTH ROUTES =============

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password valid:', validPassword);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = user.name;

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
    res.json(user);
});

// ============= USER ROUTES =============

app.get('/api/users', requireAuth, (req, res) => {
    const users = db.prepare('SELECT id, name, email, role, active FROM users WHERE active = 1').all();
    res.json(users);
});

app.post('/api/users', requireAdmin, async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password || 'member123', 10);

        const result = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
            name, email, hashedPassword, 'member'
        );

        // Auto-create member board
        db.prepare('INSERT INTO boards (workspace, name, type, ownerUserId) VALUES (?, ?, ?, ?)').run(
            'tasks', `${name}'s Board`, 'MEMBER_BOARD', result.lastInsertRowid
        );

        const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);
        res.json(user);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;

    // Unassign all tasks
    db.prepare('UPDATE tasks SET assignedUserId = NULL WHERE assignedUserId = ?').run(id);

    // Deactivate user
    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);

    res.json({ success: true });
});

// ============= BOARD ROUTES =============

app.get('/api/boards', requireAuth, (req, res) => {
    let boards;

    if (req.session.userRole === 'admin') {
        boards = db.prepare('SELECT * FROM boards WHERE workspace = ? ORDER BY type, name').all('tasks');
    } else {
        // Members only see All Tasks board and their own board
        boards = db.prepare(`
      SELECT * FROM boards 
      WHERE workspace = ? AND (type = ? OR ownerUserId = ?)
      ORDER BY type, name
    `).all('tasks', 'ALL_TASKS', req.session.userId);
    }

    res.json(boards);
});

// ============= TASK ROUTES =============

app.get('/api/tasks', requireAuth, (req, res) => {
    let tasks;

    if (req.session.userRole === 'admin') {
        tasks = db.prepare(`
      SELECT t.*, u.name as assignedUserName, c.name as createdByName
      FROM tasks t
      LEFT JOIN users u ON t.assignedUserId = u.id
      LEFT JOIN users c ON t.createdBy = c.id
      ORDER BY t.createdAt DESC
    `).all();
    } else {
        // Members only see tasks assigned to them
        tasks = db.prepare(`
      SELECT t.*, u.name as assignedUserName, c.name as createdByName
      FROM tasks t
      LEFT JOIN users u ON t.assignedUserId = u.id
      LEFT JOIN users c ON t.createdBy = c.id
      WHERE t.assignedUserId = ?
      ORDER BY t.createdAt DESC
    `).all(req.session.userId);
    }

    res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req, res) => {
    const { title, description, status, priority, dueDate, assignedUserId, labels } = req.body;

    try {
        const result = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, dueDate, assignedUserId, createdBy, labels)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            title,
            description || null,
            status || 'todo',
            priority || 'medium',
            dueDate || null,
            assignedUserId || null,
            req.session.userId,
            labels || null
        );

        // Log activity
        db.prepare('INSERT INTO task_activity (taskId, message, createdBy) VALUES (?, ?, ?)').run(
            result.lastInsertRowid,
            'Task created',
            req.session.userId
        );

        const task = db.prepare(`
      SELECT t.*, u.name as assignedUserName, c.name as createdByName
      FROM tasks t
      LEFT JOIN users u ON t.assignedUserId = u.id
      LEFT JOIN users c ON t.createdBy = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

        res.json(task);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedUserId, labels } = req.body;

    try {
        db.prepare(`
      UPDATE tasks 
      SET title = ?, description = ?, status = ?, priority = ?, dueDate = ?, 
          assignedUserId = ?, labels = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, status, priority, dueDate, assignedUserId, labels, id);

        const task = db.prepare(`
      SELECT t.*, u.name as assignedUserName, c.name as createdByName
      FROM tasks t
      LEFT JOIN users u ON t.assignedUserId = u.id
      LEFT JOIN users c ON t.createdBy = c.id
      WHERE t.id = ?
    `).get(id);

        res.json(task);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ success: true });
});

app.get('/api/tasks/:id/activity', requireAuth, (req, res) => {
    const { id } = req.params;
    const activity = db.prepare(`
    SELECT a.*, u.name as userName
    FROM task_activity a
    JOIN users u ON a.createdBy = u.id
    WHERE a.taskId = ?
    ORDER BY a.createdAt DESC
  `).all(id);
    res.json(activity);
});

app.post('/api/tasks/:id/activity', requireAuth, (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    const result = db.prepare('INSERT INTO task_activity (taskId, message, createdBy) VALUES (?, ?, ?)').run(
        id, message, req.session.userId
    );

    const activity = db.prepare(`
    SELECT a.*, u.name as userName
    FROM task_activity a
    JOIN users u ON a.createdBy = u.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

    res.json(activity);
});

// ============= PROJECT ROUTES =============

app.get('/api/projects', requireAuth, (req, res) => {
    const projects = db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all();
    res.json(projects);
});

app.post('/api/projects', requireAdmin, (req, res) => {
    const { name, client, status, startDate, endDate, description } = req.body;

    const result = db.prepare(`
    INSERT INTO projects (name, client, status, startDate, endDate, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, client, status || 'active', startDate, endDate, description);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    res.json(project);
});

app.put('/api/projects/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, client, status, startDate, endDate, description } = req.body;

    db.prepare(`
    UPDATE projects 
    SET name = ?, client = ?, status = ?, startDate = ?, endDate = ?, description = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, client, status, startDate, endDate, description, id);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json(project);
});

app.delete('/api/projects/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.json({ success: true });
});

// ============= MILESTONE ROUTES =============

app.get('/api/projects/:projectId/milestones', requireAuth, (req, res) => {
    const { projectId } = req.params;
    const milestones = db.prepare('SELECT * FROM milestones WHERE projectId = ? ORDER BY orderIndex').all(projectId);
    res.json(milestones);
});

app.post('/api/projects/:projectId/milestones', requireAdmin, (req, res) => {
    const { projectId } = req.params;
    const { title, dueDate, status, details } = req.body;

    const maxOrder = db.prepare('SELECT MAX(orderIndex) as max FROM milestones WHERE projectId = ?').get(projectId);
    const orderIndex = (maxOrder.max || -1) + 1;

    const result = db.prepare(`
    INSERT INTO milestones (projectId, title, dueDate, status, details, orderIndex)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(projectId, title, dueDate, status || 'not_started', details, orderIndex);

    const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(result.lastInsertRowid);
    res.json(milestone);
});

app.put('/api/milestones/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { title, dueDate, status, details } = req.body;

    db.prepare(`
    UPDATE milestones SET title = ?, dueDate = ?, status = ?, details = ? WHERE id = ?
  `).run(title, dueDate, status, details, id);

    const milestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
    res.json(milestone);
});

app.delete('/api/milestones/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
    res.json({ success: true });
});

// ============= CHECKLIST ROUTES =============

app.get('/api/milestones/:milestoneId/checklist', requireAuth, (req, res) => {
    const { milestoneId } = req.params;
    const items = db.prepare('SELECT * FROM milestone_checklist_items WHERE milestoneId = ? ORDER BY orderIndex').all(milestoneId);
    res.json(items);
});

app.post('/api/milestones/:milestoneId/checklist', requireAdmin, (req, res) => {
    const { milestoneId } = req.params;
    const { text } = req.body;

    const maxOrder = db.prepare('SELECT MAX(orderIndex) as max FROM milestone_checklist_items WHERE milestoneId = ?').get(milestoneId);
    const orderIndex = (maxOrder.max || -1) + 1;

    const result = db.prepare(`
    INSERT INTO milestone_checklist_items (milestoneId, text, orderIndex)
    VALUES (?, ?, ?)
  `).run(milestoneId, text, orderIndex);

    const item = db.prepare('SELECT * FROM milestone_checklist_items WHERE id = ?').get(result.lastInsertRowid);
    res.json(item);
});

app.put('/api/checklist/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { text, isDone } = req.body;

    db.prepare('UPDATE milestone_checklist_items SET text = ?, isDone = ? WHERE id = ?').run(text, isDone, id);

    const item = db.prepare('SELECT * FROM milestone_checklist_items WHERE id = ?').get(id);
    res.json(item);
});

app.delete('/api/checklist/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM milestone_checklist_items WHERE id = ?').run(id);
    res.json({ success: true });
});

// ============= PROJECT LOGS ROUTES =============

app.get('/api/projects/:projectId/logs', requireAuth, (req, res) => {
    const { projectId } = req.params;
    const logs = db.prepare(`
    SELECT l.*, u.name as userName
    FROM project_logs l
    JOIN users u ON l.createdBy = u.id
    WHERE l.projectId = ?
    ORDER BY l.createdAt DESC
  `).all(projectId);
    res.json(logs);
});

app.post('/api/projects/:projectId/logs', requireAdmin, (req, res) => {
    const { projectId } = req.params;
    const { type, message } = req.body;

    const result = db.prepare(`
    INSERT INTO project_logs (projectId, type, message, createdBy)
    VALUES (?, ?, ?, ?)
  `).run(projectId, type, message, req.session.userId);

    const log = db.prepare(`
    SELECT l.*, u.name as userName
    FROM project_logs l
    JOIN users u ON l.createdBy = u.id
    WHERE l.id = ?
  `).get(result.lastInsertRowid);

    res.json(log);
});

// ============= PROJECT ACCESS ITEMS ROUTES =============

app.get('/api/projects/:projectId/access', requireAuth, (req, res) => {
    const { projectId } = req.params;
    const items = db.prepare('SELECT * FROM project_access_items WHERE projectId = ? ORDER BY requestedAt').all(projectId);
    res.json(items);
});

app.post('/api/projects/:projectId/access', requireAdmin, (req, res) => {
    const { projectId } = req.params;
    const { platform, description, notes } = req.body;

    const result = db.prepare(`
    INSERT INTO project_access_items (projectId, platform, description, notes)
    VALUES (?, ?, ?, ?)
  `).run(projectId, platform, description || null, notes || null);

    const item = db.prepare('SELECT * FROM project_access_items WHERE id = ?').get(result.lastInsertRowid);
    res.json(item);
});

app.put('/api/access/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const { platform, description, isGranted, grantedEmail, notes } = req.body;

    const grantedAt = isGranted ? new Date().toISOString() : null;

    db.prepare(`
    UPDATE project_access_items 
    SET platform = ?, description = ?, isGranted = ?, grantedAt = ?, grantedEmail = ?, notes = ?
    WHERE id = ?
  `).run(platform, description, isGranted ? 1 : 0, grantedAt, grantedEmail || null, notes, id);

    const item = db.prepare('SELECT * FROM project_access_items WHERE id = ?').get(id);
    res.json(item);
});

app.delete('/api/access/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM project_access_items WHERE id = ?').run(id);
    res.json({ success: true });
});

// Temporary seed endpoint for initial deployment (call once then remove)
app.post('/api/seed-database', async (req, res) => {
    try {
        // Check if admin already exists
        const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@taskmanager.com');
        if (existingAdmin) {
            return res.json({ message: 'Database already seeded', users: ['admin@taskmanager.com', 'member@taskmanager.com'] });
        }

        // Create admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        db.prepare(`
            INSERT INTO users (email, password, name, role)
            VALUES (?, ?, ?, ?)
        `).run('admin@taskmanager.com', adminPassword, 'Admin User', 'admin');

        // Create member user
        const memberPassword = await bcrypt.hash('member123', 10);
        db.prepare(`
            INSERT INTO users (email, password, name, role)
            VALUES (?, ?, ?, ?)
        `).run('member@taskmanager.com', memberPassword, 'Team Member', 'member');

        res.json({
            success: true,
            message: 'Database seeded successfully!',
            users: [
                { email: 'admin@taskmanager.com', password: 'admin123', role: 'admin' },
                { email: 'member@taskmanager.com', password: 'member123', role: 'member' }
            ]
        });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ error: 'Failed to seed database', details: error.message });
    }
});

// GET version for easy browser access
app.get('/api/seed-database', async (req, res) => {
    try {
        // Create/Update admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        db.prepare(`
            INSERT OR IGNORE INTO users (email, password, name, role)
            VALUES (?, ?, ?, ?)
        `).run('admin@taskmanager.com', adminPassword, 'Admin User', 'admin');

        // Force update password
        db.prepare('UPDATE users SET password = ? WHERE email = ?').run(adminPassword, 'admin@taskmanager.com');

        // Create/Update member user
        const memberPassword = await bcrypt.hash('member123', 10);
        db.prepare(`
            INSERT OR IGNORE INTO users (email, password, name, role)
            VALUES (?, ?, ?, ?)
        `).run('member@taskmanager.com', memberPassword, 'Team Member', 'member');

        // Force update password
        db.prepare('UPDATE users SET password = ? WHERE email = ?').run(memberPassword, 'member@taskmanager.com');

        // Ensure default board exists
        db.prepare(`
            INSERT OR IGNORE INTO boards (workspace, name, type)
            VALUES (?, ?, ?)
        `).run('tasks', 'All Tasks', 'ALL_TASKS');

        res.send(`
            <html>
            <head><title>Database Seeded Successfully</title></head>
            <body style="font-family: Arial; padding: 50px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="background: white; color: #333; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #667eea;">🎉 Database Seeded & Passwords Reset!</h1>
                    <p>Your users have been created/updated with default credentials.</p>
                    <div style="background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3>Login Credentials:</h3>
                        <p><strong>Admin:</strong><br>admin@taskmanager.com / admin123</p>
                        <p><strong>Member:</strong><br>member@taskmanager.com / member123</p>
                    </div>
                    <p style="color: #d9534f; font-size: 14px;">⚠️ Passwords have been reset to defaults.</p>
                    <br>
                    <a href="/" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Go to Login Page</a>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).send(`
            <html>
            <head><title>Seed Error</title></head>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
                <h1 style="color: red;">❌ Error Seeding Database</h1>
                <p>${error.message}</p>
                <a href="/" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go Back</a>
            </body>
            </html>
        `);
    }
});

// ============= DASHBOARD ROUTES =============

// Get dashboard statistics
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const isAdmin = req.session.userRole === 'admin';

    try {
        // Get task statistics
        let taskQuery = 'SELECT status, priority, COUNT(*) as count FROM tasks';
        let taskParams = [];

        if (!isAdmin) {
            taskQuery += ' WHERE assignedUserId = ?';
            taskParams.push(userId);
        }

        taskQuery += ' GROUP BY status, priority';
        const taskStats = db.prepare(taskQuery).all(...taskParams);

        // Get total counts
        let totalQuery = 'SELECT COUNT(*) as total FROM tasks';
        let totalParams = [];
        if (!isAdmin) {
            totalQuery += ' WHERE assignedUserId = ?';
            totalParams.push(userId);
        }
        const totalTasks = db.prepare(totalQuery).get(...totalParams).total;

        // Get upcoming tasks (next 7 days)
        const upcomingQuery = isAdmin
            ? `SELECT t.*, u.name as assignedUserName 
               FROM tasks t 
               LEFT JOIN users u ON t.assignedUserId = u.id 
               WHERE t.status != 'done' AND t.dueDate IS NOT NULL 
               AND date(t.dueDate) BETWEEN date('now') AND date('now', '+7 days')
               ORDER BY t.dueDate ASC LIMIT 10`
            : `SELECT t.*, u.name as assignedUserName 
               FROM tasks t 
               LEFT JOIN users u ON t.assignedUserId = u.id 
               WHERE t.assignedUserId = ? AND t.status != 'done' AND t.dueDate IS NOT NULL 
               AND date(t.dueDate) BETWEEN date('now') AND date('now', '+7 days')
               ORDER BY t.dueDate ASC LIMIT 10`;

        const upcomingTasks = isAdmin
            ? db.prepare(upcomingQuery).all()
            : db.prepare(upcomingQuery).all(userId);

        // Get completed tasks (last 10)
        const completedQuery = isAdmin
            ? `SELECT t.*, u.name as assignedUserName 
               FROM tasks t 
               LEFT JOIN users u ON t.assignedUserId = u.id 
               WHERE t.status = 'done' 
               ORDER BY t.updatedAt DESC LIMIT 10`
            : `SELECT t.*, u.name as assignedUserName 
               FROM tasks t 
               LEFT JOIN users u ON t.assignedUserId = u.id 
               WHERE t.assignedUserId = ? AND t.status = 'done' 
               ORDER BY t.updatedAt DESC LIMIT 10`;

        const completedTasks = isAdmin
            ? db.prepare(completedQuery).all()
            : db.prepare(completedQuery).all(userId);

        // Get attendance summary for today
        const attendanceQuery = isAdmin
            ? `SELECT COUNT(*) as total, 
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
               FROM attendance WHERE date(clockInTime) = date('now')`
            : `SELECT * FROM attendance 
               WHERE userId = ? AND date(clockInTime) = date('now')
               ORDER BY clockInTime DESC LIMIT 1`;

        const attendanceSummary = isAdmin
            ? db.prepare(attendanceQuery).get()
            : db.prepare(attendanceQuery).get(userId);

        // Calculate task breakdown by status
        const statusBreakdown = {
            todo: 0,
            in_progress: 0,
            blocked: 0,
            done: 0
        };

        const priorityBreakdown = {
            low: 0,
            medium: 0,
            high: 0
        };

        taskStats.forEach(stat => {
            statusBreakdown[stat.status] = (statusBreakdown[stat.status] || 0) + stat.count;
            priorityBreakdown[stat.priority] = (priorityBreakdown[stat.priority] || 0) + stat.count;
        });

        res.json({
            totalTasks,
            statusBreakdown,
            priorityBreakdown,
            upcomingTasks,
            completedTasks,
            attendanceSummary
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to load dashboard statistics' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 SloraAI Task Manager server running on http://localhost:${PORT}`);
    console.log(`📝 Login at http://localhost:${PORT}\n`);
});
