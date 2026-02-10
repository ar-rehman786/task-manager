const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const { pool, query, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Database initialization will be called on startup


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
        const result = await query('SELECT * FROM users WHERE email = $1 AND active = 1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password' });
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

app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT id, name, email, role FROM users WHERE id = $1', [req.session.userId]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============= USER ROUTES =============

app.get('/api/users', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT id, name, email, role, active FROM users WHERE active = 1');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/users', requireAdmin, async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password || 'member123', 10);

        const userResult = await query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, hashedPassword, 'member']
        );
        const user = userResult.rows[0];

        // Auto-create member board
        await query(
            'INSERT INTO boards (workspace, name, type, "ownerUserId") VALUES ($1, $2, $3, $4)',
            ['tasks', `${name}'s Board`, 'MEMBER_BOARD', user.id]
        );

        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        res.status(500).json({ error: 'Failed to create user: ' + error.message });
    }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        // Unassign all tasks
        await query('UPDATE tasks SET "assignedUserId" = NULL WHERE "assignedUserId" = $1', [id]);

        // Deactivate user
        await query('UPDATE users SET active = 0 WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ============= BOARD ROUTES =============

app.get('/api/boards', requireAuth, async (req, res) => {
    try {
        let result;
        if (req.session.userRole === 'admin') {
            result = await query('SELECT * FROM boards WHERE workspace = $1 ORDER BY type, name', ['tasks']);
        } else {
            // Members only see All Tasks board and their own board
            result = await query(`
                SELECT * FROM boards 
                WHERE workspace = $1 AND (type = $2 OR "ownerUserId" = $3)
                ORDER BY type, name
            `, ['tasks', 'ALL_TASKS', req.session.userId]);
        }
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============= TASK ROUTES =============

app.get('/api/tasks', requireAuth, async (req, res) => {
    try {
        let result;
        if (req.session.userRole === 'admin') {
            result = await query(`
                SELECT t.*, u.name as "assignedUserName", c.name as "createdByName"
                FROM tasks t
                LEFT JOIN users u ON t."assignedUserId" = u.id
                LEFT JOIN users c ON t."createdBy" = c.id
                ORDER BY t."createdAt" DESC
            `);
        } else {
            result = await query(`
                SELECT t.*, u.name as "assignedUserName", c.name as "createdByName"
                FROM tasks t
                LEFT JOIN users u ON t."assignedUserId" = u.id
                LEFT JOIN users c ON t."createdBy" = c.id
                WHERE t."assignedUserId" = $1
                ORDER BY t."createdAt" DESC
            `, [req.session.userId]);
        }
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
    const { title, description, status, priority, dueDate, assignedUserId, labels } = req.body;

    try {
        const result = await query(`
            INSERT INTO tasks (title, description, status, priority, "dueDate", "assignedUserId", "createdBy", labels)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            title,
            description || null,
            status || 'todo',
            priority || 'medium',
            dueDate || null,
            assignedUserId || null,
            req.session.userId,
            labels || null
        ]);

        const task = result.rows[0];

        // Log activity
        await query('INSERT INTO task_activity ("taskId", message, "createdBy") VALUES ($1, $2, $3)', [
            task.id,
            'Task created',
            req.session.userId
        ]);

        // Get full task details with names
        const fullTask = await query(`
            SELECT t.*, u.name as "assignedUserName", c.name as "createdByName"
            FROM tasks t
            LEFT JOIN users u ON t."assignedUserId" = u.id
            LEFT JOIN users c ON t."createdBy" = c.id
            WHERE t.id = $1
        `, [task.id]);

        res.json(fullTask.rows[0]);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedUserId, labels } = req.body;

    try {
        await query(`
            UPDATE tasks 
            SET title = $1, description = $2, status = $3, priority = $4, "dueDate" = $5, 
                "assignedUserId" = $6, labels = $7, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $8
        `, [title, description, status, priority, dueDate, assignedUserId, labels, id]);

        const task = await query(`
            SELECT t.*, u.name as "assignedUserName", c.name as "createdByName"
            FROM tasks t
            LEFT JOIN users u ON t."assignedUserId" = u.id
            LEFT JOIN users c ON t."createdBy" = c.id
            WHERE t.id = $1
        `, [id]);

        res.json(task.rows[0]);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM tasks WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting task' });
    }
});

app.get('/api/tasks/:id/activity', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const activity = await query(`
            SELECT a.*, u.name as "userName"
            FROM task_activity a
            JOIN users u ON a."createdBy" = u.id
            WHERE a."taskId" = $1
            ORDER BY a."createdAt" DESC
        `, [id]);
        res.json(activity.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching activity' });
    }
});

app.post('/api/tasks/:id/activity', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    try {
        const result = await query(
            'INSERT INTO task_activity ("taskId", message, "createdBy") VALUES ($1, $2, $3) RETURNING *',
            [id, message, req.session.userId]
        );
        const newActivity = result.rows[0];

        const fullActivity = await query(`
            SELECT a.*, u.name as "userName"
            FROM task_activity a
            JOIN users u ON a."createdBy" = u.id
            WHERE a.id = $1
        `, [newActivity.id]);

        res.json(fullActivity.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error adding activity' });
    }
});

// ============= PROJECT ROUTES =============

app.get('/api/projects', requireAuth, async (req, res) => {
    try {
        const projects = await query('SELECT * FROM projects ORDER BY "createdAt" DESC');
        res.json(projects.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching projects' });
    }
});

app.post('/api/projects', requireAdmin, async (req, res) => {
    const { name, client, status, startDate, endDate, description } = req.body;

    try {
        const result = await query(`
            INSERT INTO projects (name, client, status, "startDate", "endDate", description)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [name, client, status || 'active', startDate, endDate, description]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating project' });
    }
});

app.put('/api/projects/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, client, status, startDate, endDate, description } = req.body;

    try {
        await query(`
            UPDATE projects 
            SET name = $1, client = $2, status = $3, "startDate" = $4, "endDate" = $5, description = $6, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [name, client, status, startDate, endDate, description, id]);

        const project = await query('SELECT * FROM projects WHERE id = $1', [id]);
        res.json(project.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating project' });
    }
});

app.delete('/api/projects/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM projects WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting project' });
    }
});

// ============= MILESTONE ROUTES =============

app.get('/api/projects/:projectId/milestones', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    try {
        const milestones = await query('SELECT * FROM milestones WHERE "projectId" = $1 ORDER BY "orderIndex"', [projectId]);
        res.json(milestones.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching milestones' });
    }
});

app.post('/api/projects/:projectId/milestones', requireAdmin, async (req, res) => {
    const { projectId } = req.params;
    const { title, dueDate, status, details } = req.body;

    try {
        const maxOrderResult = await query('SELECT MAX("orderIndex") as max FROM milestones WHERE "projectId" = $1', [projectId]);
        const orderIndex = (maxOrderResult.rows[0].max || -1) + 1;

        const result = await query(`
            INSERT INTO milestones ("projectId", title, "dueDate", status, details, "orderIndex")
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [projectId, title, dueDate, status || 'not_started', details, orderIndex]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating milestone' });
    }
});

app.put('/api/milestones/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, dueDate, status, details } = req.body;

    try {
        await query(`
            UPDATE milestones SET title = $1, "dueDate" = $2, status = $3, details = $4 WHERE id = $5
        `, [title, dueDate, status, details, id]);
        const milestone = await query('SELECT * FROM milestones WHERE id = $1', [id]);
        res.json(milestone.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating milestone' });
    }
});

app.delete('/api/milestones/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM milestones WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting milestone' });
    }
});

// ============= CHECKLIST ROUTES =============

app.get('/api/milestones/:milestoneId/checklist', requireAuth, async (req, res) => {
    const { milestoneId } = req.params;
    try {
        const items = await query('SELECT * FROM milestone_checklist_items WHERE "milestoneId" = $1 ORDER BY "orderIndex"', [milestoneId]);
        res.json(items.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching checklist' });
    }
});

app.post('/api/milestones/:milestoneId/checklist', requireAdmin, async (req, res) => {
    const { milestoneId } = req.params;
    const { text } = req.body;

    try {
        const maxOrderResult = await query('SELECT MAX("orderIndex") as max FROM milestone_checklist_items WHERE "milestoneId" = $1', [milestoneId]);
        const orderIndex = (maxOrderResult.rows[0].max || -1) + 1;

        const result = await query(`
            INSERT INTO milestone_checklist_items ("milestoneId", text, "orderIndex")
            VALUES ($1, $2, $3) RETURNING *
        `, [milestoneId, text, orderIndex]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating checklist item' });
    }
});

app.put('/api/checklist/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { text, isDone } = req.body;

    try {
        await query('UPDATE milestone_checklist_items SET text = $1, "isDone" = $2 WHERE id = $3', [text, isDone ? 1 : 0, id]);
        const item = await query('SELECT * FROM milestone_checklist_items WHERE id = $1', [id]);
        res.json(item.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating checklist item' });
    }
});

app.delete('/api/checklist/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM milestone_checklist_items WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting checklist item' });
    }
});

// ============= PROJECT LOGS ROUTES =============

app.get('/api/projects/:projectId/logs', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    try {
        const logs = await query(`
            SELECT l.*, u.name as "userName"
            FROM project_logs l
            JOIN users u ON l."createdBy" = u.id
            WHERE l."projectId" = $1
            ORDER BY l."createdAt" DESC
        `, [projectId]);
        res.json(logs.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching logs' });
    }
});

app.post('/api/projects/:projectId/logs', requireAdmin, async (req, res) => {
    const { projectId } = req.params;
    const { type, message } = req.body;

    try {
        const result = await query(`
            INSERT INTO project_logs ("projectId", type, message, "createdBy")
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [projectId, type, message, req.session.userId]);

        const log = await query(`
            SELECT l.*, u.name as "userName"
            FROM project_logs l
            JOIN users u ON l."createdBy" = u.id
            WHERE l.id = $1
        `, [result.rows[0].id]);

        res.json(log.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating log' });
    }
});

// ============= PROJECT ACCESS ITEMS ROUTES =============

app.get('/api/projects/:projectId/access', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    try {
        const items = await query('SELECT * FROM project_access_items WHERE "projectId" = $1 ORDER BY "requestedAt"', [projectId]);
        res.json(items.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching access items' });
    }
});

app.post('/api/projects/:projectId/access', requireAdmin, async (req, res) => {
    const { projectId } = req.params;
    const { platform, description, notes } = req.body;

    try {
        const result = await query(`
            INSERT INTO project_access_items ("projectId", platform, description, notes)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [projectId, platform, description || null, notes || null]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating access item' });
    }
});

app.put('/api/access/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { platform, description, isGranted, grantedEmail, notes } = req.body;

    const grantedAt = isGranted ? new Date().toISOString() : null;

    try {
        await query(`
            UPDATE project_access_items 
            SET platform = $1, description = $2, "isGranted" = $3, "grantedAt" = $4, "grantedEmail" = $5, notes = $6
            WHERE id = $7
        `, [platform, description, isGranted ? 1 : 0, grantedAt, grantedEmail || null, notes, id]);

        const item = await query('SELECT * FROM project_access_items WHERE id = $1', [id]);
        res.json(item.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating access item' });
    }
});

app.delete('/api/access/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM project_access_items WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting access item' });
    }
});

// ============= ATTENDANCE ROUTES =============

app.get('/api/attendance/status', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT * FROM attendance WHERE "userId" = $1 AND status = \'active\'', [req.session.userId]);
        res.json(result.rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/attendance/clock-in', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { notes } = req.body;

    try {
        const activeSessionResult = await query('SELECT * FROM attendance WHERE "userId" = $1 AND status = \'active\'', [userId]);
        if (activeSessionResult.rows[0]) {
            return res.status(400).json({ error: 'You are already clocked in' });
        }

        const result = await query(`
            INSERT INTO attendance ("userId", "clockInTime", status, notes)
            VALUES ($1, $2, 'active', $3) RETURNING *
        `, [userId, new Date().toISOString(), notes]);

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Clock in error' });
    }
});

app.post('/api/attendance/clock-out', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { notes } = req.body;

    try {
        const activeSessionResult = await query('SELECT * FROM attendance WHERE "userId" = $1 AND status = \'active\'', [userId]);
        const activeSession = activeSessionResult.rows[0];

        if (!activeSession) {
            return res.status(400).json({ error: 'You are not clocked in' });
        }

        const clockOutTime = new Date();
        const clockInTime = new Date(activeSession.clockInTime);
        const workDuration = Math.round((clockOutTime - clockInTime) / 1000 / 60);

        await query(`
            UPDATE attendance 
            SET "clockOutTime" = $1, status = 'completed', "workDuration" = $2, notes = $3
            WHERE id = $4
        `, [
            clockOutTime.toISOString(),
            workDuration,
            notes ? (activeSession.notes + '\n' + notes) : activeSession.notes,
            activeSession.id
        ]);

        const session = await query('SELECT * FROM attendance WHERE id = $1', [activeSession.id]);
        res.json(session.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Clock out error' });
    }
});

app.get('/api/attendance/history', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { limit = 30 } = req.query;

    try {
        const history = await query(`
            SELECT * FROM attendance 
            WHERE "userId" = $1 
            ORDER BY "clockInTime" DESC 
            LIMIT $2
        `, [userId, limit]);
        res.json(history.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching history' });
    }
});

app.get('/api/attendance/today', requireAdmin, async (req, res) => {
    try {
        const records = await query(`
            SELECT a.*, u.name as "userName", u.email as "userEmail"
            FROM attendance a
            JOIN users u ON a."userId" = u.id
            WHERE date(a."clockInTime") = CURRENT_DATE
            ORDER BY a."clockInTime" DESC
        `);
        res.json(records.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching today attendance' });
    }
});

// Seed endpoint (Postgres Version)
app.post('/api/seed-database', async (req, res) => {
    try {
        // Run the seed logic
        await seedDatabase();

        // Return default success message (users might already exist)
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

app.get('/api/seed-database', async (req, res) => {
    try {
        await seedDatabase();
        res.send(`
            <html>
            <head><title>Database Seeded</title></head>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
                <h1 style="color: #667eea;">PostgreSQL Database Initialized</h1>
                <p>Default users ensured.</p>
                <a href="/">Go to Login</a>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send('Error seeding');
    }
});

// ============= DASHBOARD ROUTES =============

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const isAdmin = req.session.userRole === 'admin';

    try {
        // Get task statistics
        let taskQuery = 'SELECT status, priority, COUNT(*) as count FROM tasks';
        let taskParams = [];

        if (!isAdmin) {
            taskQuery += ' WHERE "assignedUserId" = $1';
            taskParams.push(userId);
        }

        taskQuery += ' GROUP BY status, priority';
        const taskStatsResult = await query(taskQuery, taskParams);
        const taskStats = taskStatsResult.rows;

        // Get total counts
        let totalQuery = 'SELECT COUNT(*) as total FROM tasks';
        let totalParams = [];
        if (!isAdmin) {
            totalQuery += ' WHERE "assignedUserId" = $1';
            totalParams.push(userId);
        }
        const totalResult = await query(totalQuery, totalParams);
        const totalTasks = parseInt(totalResult.rows[0].total);

        // Get upcoming tasks
        let upcomingResult;
        if (isAdmin) {
            upcomingResult = await query(`
                SELECT t.*, u.name as "assignedUserName"
                FROM tasks t 
                LEFT JOIN users u ON t."assignedUserId" = u.id 
                WHERE t.status != 'done' AND t."dueDate" IS NOT NULL 
                AND t."dueDate" BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
                ORDER BY t."dueDate" ASC LIMIT 10
            `);
        } else {
            upcomingResult = await query(`
                SELECT t.*, u.name as "assignedUserName"
                FROM tasks t 
                LEFT JOIN users u ON t."assignedUserId" = u.id 
                WHERE t."assignedUserId" = $1 AND t.status != 'done' AND t."dueDate" IS NOT NULL 
                AND t."dueDate" BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
                ORDER BY t."dueDate" ASC LIMIT 10
            `, [userId]);
        }
        const upcomingTasks = upcomingResult.rows;

        // Get completed tasks
        let completedResult;
        if (isAdmin) {
            completedResult = await query(`
                SELECT t.*, u.name as "assignedUserName"
                FROM tasks t 
                LEFT JOIN users u ON t."assignedUserId" = u.id 
                WHERE t.status = 'done' 
                ORDER BY t."updatedAt" DESC LIMIT 10
            `);
        } else {
            completedResult = await query(`
                SELECT t.*, u.name as "assignedUserName"
                FROM tasks t 
                LEFT JOIN users u ON t."assignedUserId" = u.id 
                WHERE t."assignedUserId" = $1 AND t.status = 'done' 
                ORDER BY t."updatedAt" DESC LIMIT 10
            `, [userId]);
        }
        const completedTasks = completedResult.rows;

        // Get attendance summary
        let attendanceSummary;
        if (isAdmin) {
            const summaryResult = await query(`
                SELECT COUNT(*) as total, 
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
                FROM attendance WHERE date("clockInTime") = CURRENT_DATE
            `);
            attendanceSummary = summaryResult.rows[0];
            // Fix parseInt for postgres counts which return strings
            attendanceSummary = {
                total: parseInt(attendanceSummary.total || 0),
                active: parseInt(attendanceSummary.active || 0)
            };
        } else {
            const summaryResult = await query(`
                SELECT * FROM attendance 
                WHERE "userId" = $1 AND date("clockInTime") = CURRENT_DATE
                ORDER BY "clockInTime" DESC LIMIT 1
            `, [userId]);
            attendanceSummary = summaryResult.rows[0];
        }

        // Calculate breakdown
        const statusBreakdown = { todo: 0, in_progress: 0, blocked: 0, done: 0 };
        const priorityBreakdown = { low: 0, medium: 0, high: 0 };

        taskStats.forEach(stat => {
            statusBreakdown[stat.status] = (statusBreakdown[stat.status] || 0) + parseInt(stat.count);
            priorityBreakdown[stat.priority] = (priorityBreakdown[stat.priority] || 0) + parseInt(stat.count);
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

// Auto-seed function (Postgres)
async function seedDatabase() {
    try {
        const adminResult = await query('SELECT * FROM users WHERE email = $1', ['admin@taskmanager.com']);
        if (!adminResult.rows[0]) {
            console.log('🌱 Seed: Creating Admin...');
            const adminPassword = await bcrypt.hash('admin123', 10);
            const adminUserResult = await query(`
                INSERT INTO users (email, password, name, role, active)
                VALUES ($1, $2, $3, $4, 1) RETURNING *
            `, ['admin@taskmanager.com', adminPassword, 'Admin User', 'admin']);
            const adminUser = adminUserResult.rows[0];

            console.log('🌱 Seed: Creating Member...');
            const memberPassword = await bcrypt.hash('member123', 10);
            await query(`
                INSERT INTO users (email, password, name, role, active)
                VALUES ($1, $2, $3, $4, 1)
            `, ['member@taskmanager.com', memberPassword, 'Team Member', 'member']);

            // Default board
            await query(`
                INSERT INTO boards (workspace, name, type)
                VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING
            `, ['tasks', 'All Tasks', 'ALL_TASKS']);

            console.log('✅ Auto-seed complete.');
        } else {
            // Check if active is 0, if so, reactivate
            if (adminResult.rows[0].active === 0) {
                await query('UPDATE users SET active = 1 WHERE email = $1', ['admin@taskmanager.com']);
            }
        }
    } catch (error) {
        console.error('Auto-seed failed:', error);
    }
}

app.listen(PORT, async () => {
    try {
        console.log('🔄 Initializing database...');
        await initializeDatabase();
        console.log('✅ Database initialized.');

        await seedDatabase();
        console.log(`\n🚀 SloraAI Task Manager (PostgreSQL) running on http://localhost:${PORT}`);
        console.log(`📝 Login at http://localhost:${PORT}\n`);
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
});
