console.log('🔹 SERVER.JS: Starting...');
require('dotenv').config();
console.log('🔹 SERVER.JS: Dotenv loaded');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const { pool, query, initializeDatabase } = require('./database');
const http = require('http');

console.log('🔹 SERVER.JS: Modules loaded');

const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const next = require('next');

console.log('🔹 SERVER.JS: Next.js module loaded');

const dev = process.env.NODE_ENV !== 'production';
let nextApp;
try {
    console.log('🔹 SERVER.JS: Initializing Next.js app...');
    nextApp = next({ dev, dir: '.' });
    console.log('🔹 SERVER.JS: Next.js app initialized');
} catch (err) {
    console.error('❌ SERVER.JS: Failed to initialize Next.js app:', err);
    process.exit(1);
}
const handle = nextApp.getRequestHandler();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'public/uploads/profiles';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        console.log(`[UPLOAD-DEBUG] Filtering file: ${file.originalname}, mimetype: ${file.mimetype}`);
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            console.warn(`[UPLOAD-DEBUG] File rejected: ${file.mimetype}`);
            cb(new Error('Only images are allowed'));
        }
    }
});

// Configure Multer for general uploads (Descriptions, Projects)
const generalStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        let dir = 'public/uploads/general';
        if (file.fieldname === 'projectFile') {
            dir = `public/uploads/projects/${req.params.projectId}/files`;
        } else if (file.fieldname === 'image') {
            dir = 'public/uploads/descriptions';
        }

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const generalUpload = multer({
    storage: generalStorage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
        socket.join(`user:${userId}`);
        console.log(`Socket ${socket.id} joined user:${userId}`);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Helper function to send notifications
async function sendNotification(userId, type, message, data = {}) {
    try {
        console.log(`[NOTIFICATION] ======================================`);
        console.log(`[NOTIFICATION] Sending to user ${userId}`);
        console.log(`[NOTIFICATION] Type: ${type}`);
        console.log(`[NOTIFICATION] Message: ${message}`);
        console.log(`[NOTIFICATION] Data:`, data);

        // 1. Save to database
        const result = await query(`
            INSERT INTO notifications ("userId", type, message, data)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [userId, type, message, JSON.stringify(data)]);

        console.log(`[NOTIFICATION] Saved to DB with ID: ${result.rows[0].id}`);

        // 2. Emit via Socket.io
        const notification = {
            type,
            message,
            data,
            createdAt: new Date().toISOString()
        };

        io.to(`user:${userId}`).emit('notification', notification);
        console.log(`[NOTIFICATION] Emitted to room: user:${userId}`);
        console.log(`[NOTIFICATION] Socket.io rooms count: ${io.sockets.adapter.rooms.size}`);
        console.log(`[NOTIFICATION] ======================================`);

    } catch (error) {
        console.error('[NOTIFICATION ERROR] ======================================');
        console.error('[NOTIFICATION ERROR] Failed to send notification');
        console.error('[NOTIFICATION ERROR]', error);
        console.error('[NOTIFICATION ERROR] ======================================');
    }
}





// Helper for startup errors
let startupError = null;

// Middleware
app.use((req, res, next) => {
    if (startupError) {
        return res.status(500).send(`
            <html>
            <body style="font-family: monospace; background: #0f172a; color: #ef4444; padding: 2rem; max-width: 800px; margin: 0 auto;">
                <h1 style="border-bottom: 2px solid #334155; padding-bottom: 1rem;">⚠️ Application Startup Failed</h1>
                <p style="color: #cbd5e1; font-size: 1.1rem;">The server started, but the database initialization failed.</p>
                <div style="background: #1e293b; padding: 1.5rem; border-radius: 0.5rem; overflow: auto; margin: 2rem 0; border: 1px solid #334155;">
                    <strong style="color: #fca5a5; display: block; margin-bottom: 0.5rem;">Error Details:</strong>
                    <pre style="margin: 0; white-space: pre-wrap;">${startupError.stack || startupError.message}</pre>
                </div>
                <p style="color: #94a3b8;">Please check your Railway logs and DATABASE_URL variable.</p>
            </body>
            </html>
        `);
    }
    next();
});

// CORS middleware for Next.js frontend
app.use((req, res, next) => {
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.set('trust proxy', 1); // Trust first proxy (Railway)

const pgSession = require('connect-pg-simple')(session);

app.use(session({
    store: new pgSession({
        pool: pool,                // Connection pool
        tableName: 'session'   // Use another table-name than the default "session" one
    }),
    secret: 'task-manager-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === 'production' // Secure in production
    }
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Debug Route: Force create notifications table & DIAGNOSE
app.get('/api/debug/init-notifications', async (req, res) => {
    console.log('[DEBUG_ROUTE] hit');
    const diagnosis = { steps: [] };

    try {
        // 1. Test connection
        await query('SELECT 1');
        diagnosis.steps.push('DB Connection OK');

        // 2. Create Table
        await query(`
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
        diagnosis.steps.push('Table CREATE/CHECK OK');

        // 3. Verify Table Exists
        const checkTable = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'notifications'
        `);
        if (checkTable.rows.length === 0) throw new Error('Table was NOT found after creation query!');
        diagnosis.steps.push('Table Exists in information_schema');

        // 4. Verify Columns
        const checkColumns = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notifications'
        `);
        diagnosis.columns = checkColumns.rows;

        // 5. Try a SELECT
        const count = await query('SELECT COUNT(*) FROM notifications');
        diagnosis.rowCount = count.rows[0].count;
        diagnosis.steps.push('SELECT COUNT(*) OK');

        res.json({
            success: true,
            message: 'Diagnosis Complete',
            diagnosis: diagnosis,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[DEBUG_ROUTE] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack,
            diagnosis: diagnosis
        });
    }
});

// Serve static files - DISABLED for Next.js integration
// app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        console.log(`[AUTH] Unauthorized access to ${req.originalUrl}. Session ID: ${req.sessionID}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

async function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Double check role from DB to ensure security and prevent session sync issues
        const result = await query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
        const user = result.rows[0];

        if (!user || user.role !== 'admin') {
            console.warn(`Admin access denied for User ${req.session.userId}. Role: ${user ? user.role : 'none'}`);
            return res.status(403).json({ error: 'Forbidden - Admin only' });
        }

        // Refresh session role
        req.session.userRole = user.role;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Server error checking permissions' });
    }
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

// Login endpoint (both /api/auth/login and /api/login for compatibility)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await query('SELECT * FROM users WHERE email = $1 AND active = 1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.json({ success: false, message: 'Invalid password' });
        }

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = user.name;

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const result = await query(`
            SELECT id, name, email, role, title, department, location, phone, "employeeId", "profilePicture", "coverImage", "managerId" 
            FROM users WHERE id = $1
        `, [req.session.userId]);

        // Get manager name if exists
        let user = result.rows[0];
        if (user.managerId) {
            const manager = await query('SELECT name FROM users WHERE id = $1', [user.managerId]);
            if (manager.rows[0]) {
                user.managerName = manager.rows[0].name;
            }
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// TEMP: Setup Super User Endpoint
app.get('/api/setup-super-user', async (req, res) => {
    try {
        const email = 'abdulrehmanhameed4321@gmail.com';
        const password = '()()()()';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user exists
        const check = await query('SELECT * FROM users WHERE email = $1', [email]);

        let user;
        if (check.rows.length > 0) {
            // Update
            const result = await query(
                'UPDATE users SET role = $1, password = $2, active = 1 WHERE email = $3 RETURNING *',
                ['admin', hashedPassword, email]
            );
            user = result.rows[0];
            res.json({ message: 'Super user updated successfully', user: { email: user.email, role: user.role } });
        } else {
            // Create
            const result = await query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
                ['Super Admin', email, hashedPassword, 'admin']
            );
            user = result.rows[0];

            // Create board
            await query(
                'INSERT INTO boards (workspace, name, type, "ownerUserId") VALUES ($1, $2, $3, $4)',
                ['tasks', 'Super Admin Board', 'MEMBER_BOARD', user.id]
            );

            res.json({ message: 'Super user created successfully', user: { email: user.email, role: user.role } });
        }
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ error: 'Setup failed: ' + error.message });
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
    const { name, email, password, role } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password || 'member123', 10);
        const userRole = (role === 'admin' || role === 'member') ? role : 'member';

        const userResult = await query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, hashedPassword, userRole]
        );

        const user = userResult.rows[0];

        // Auto-create member board
        await query(
            'INSERT INTO boards (workspace, name, type, "ownerUserId") VALUES ($1, $2, $3, $4)',
            ['tasks', `${name}'s Board`, 'MEMBER_BOARD', user.id]
        );

        // Notify team
        // sendNotification('new_member', `New Team Member: ${user.name}`, user);

        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        res.status(500).json({ error: 'Failed to create user: ' + error.message });
    }
});

// Update Profile API
app.put('/api/users/profile', requireAuth, upload.fields([{ name: 'profilePicture', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), async (req, res) => {
    console.log('[PROFILE-UPDATE] Request body keys:', Object.keys(req.body));
    console.log('[PROFILE-UPDATE] Files received:', req.files ? Object.keys(req.files) : 'none');

    const userId = req.session.userId;
    const { name, title, department, location, phone, employeeId, managerId } = req.body;

    try {
        const fields = [];
        const params = [];
        let idx = 1;

        // Text fields - use COALESCE for optional updates
        const textFields = { name, title, department, location, phone, employeeId };
        for (const [key, val] of Object.entries(textFields)) {
            if (val !== undefined) {
                const dbCol = key === 'employeeId' ? '"employeeId"' : key;
                fields.push(`${dbCol} = $${idx++}`);
                params.push(val);
            }
        }

        if (managerId !== undefined) {
            fields.push(`"managerId" = $${idx++}`);
            params.push(managerId || null);
        }

        // Handle profile picture - convert to base64 for persistence on ephemeral filesystems
        if (req.files && req.files['profilePicture'] && req.files['profilePicture'][0]) {
            const file = req.files['profilePicture'][0];
            const fs = require('fs');
            const fileData = fs.readFileSync(file.path);
            const base64 = `data:${file.mimetype};base64,${fileData.toString('base64')}`;
            fields.push(`"profilePicture" = $${idx++}`);
            params.push(base64);
            // Clean up temp file
            fs.unlinkSync(file.path);
        }

        if (req.files && req.files['coverImage'] && req.files['coverImage'][0]) {
            const file = req.files['coverImage'][0];
            const fs = require('fs');
            const fileData = fs.readFileSync(file.path);
            const base64 = `data:${file.mimetype};base64,${fileData.toString('base64')}`;
            fields.push(`"coverImage" = $${idx++}`);
            params.push(base64);
            fs.unlinkSync(file.path);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        params.push(userId);
        const updateQuery = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        const result = await query(updateQuery, params);
        const user = result.rows[0];

        // Notify if name changed
        if (name && name !== req.session.userName) {
            req.session.userName = name;
        }

        res.json(user);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Change Password API
app.put('/api/users/change-password', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        // Verify current password
        const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        // Check if user exists
        const check = await query('SELECT * FROM users WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build dynamic query for partial updates
        const fields = [];
        const values = [];
        let idx = 1;

        const allowedFields = {
            name: 'name',
            email: 'email',
            role: 'role',
            title: 'title',
            department: 'department',
            location: 'location',
            phone: 'phone',
            employeeId: '"employeeId"',
            active: 'active'
        };

        for (const [key, dbCol] of Object.entries(allowedFields)) {
            if (updates[key] !== undefined) {
                // Validate role if provided
                if (key === 'role' && !['admin', 'member'].includes(updates[key])) {
                    return res.status(400).json({ error: 'Invalid role' });
                }
                fields.push(`${dbCol} = $${idx++}`);
                values.push(updates[key]);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        values.push(id);
        const updateQuery = `
            UPDATE users SET ${fields.join(', ')} 
            WHERE id = $${idx} 
            RETURNING id, name, email, role, active, title, department, location, phone, "employeeId"
        `;

        const result = await query(updateQuery, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
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
            result = await query(`
                SELECT b.* 
                FROM boards b
                LEFT JOIN users u ON b."ownerUserId" = u.id
                WHERE b.workspace = $1 
                AND (u.active = 1 OR b."ownerUserId" IS NULL)
                ORDER BY b.type, b.name
            `, ['tasks']);
        } else {
            // Members only see All Tasks board and their own board (if active)
            result = await query(`
                SELECT b.* 
                FROM boards b
                LEFT JOIN users u ON b."ownerUserId" = u.id
                WHERE b.workspace = $1 
                AND (b.type = $2 OR b."ownerUserId" = $3)
                AND (u.active = 1 OR b."ownerUserId" IS NULL)
                ORDER BY b.type, b.name
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
                SELECT t.*, u.name as "assignedUserName", c.name as "createdByName", p.name as "projectName"
                FROM tasks t
                LEFT JOIN users u ON t."assignedUserId" = u.id
                LEFT JOIN users c ON t."createdBy" = c.id
                LEFT JOIN projects p ON t."projectId" = p.id
                ORDER BY t."createdAt" DESC
            `);
        } else {
            result = await query(`
                SELECT t.*, u.name as "assignedUserName", c.name as "createdByName", p.name as "projectName"
                FROM tasks t
                LEFT JOIN users u ON t."assignedUserId" = u.id
                LEFT JOIN users c ON t."createdBy" = c.id
                LEFT JOIN projects p ON t."projectId" = p.id
                WHERE t."assignedUserId" = $1 OR t."createdBy" = $1
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
    const { title, description, status, priority, dueDate, assignedUserId, labels, projectId, milestoneId, loomVideo, workflowLink, workflowStatus } = req.body;

    try {
        const result = await query(`
            INSERT INTO tasks (title, description, status, priority, "dueDate", "assignedUserId", "createdBy", labels, "projectId", "milestoneId", "loomVideo", "workflowLink", "workflowStatus")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
        `, [
            title,
            description || null,
            status || 'todo',
            priority || 'medium',
            dueDate || null,
            assignedUserId || null,
            req.session.userId,
            labels || null,
            projectId || null,
            milestoneId || null,
            loomVideo || null,
            workflowLink || null,
            workflowStatus || null
        ]);

        const task = result.rows[0];

        // Log activity
        await query('INSERT INTO task_activity ("taskId", message, "createdBy") VALUES ($1, $2, $3)', [
            task.id,
            'Task created',
            req.session.userId
        ]);

        // --- NOTIFICATION LOGIC ---
        if (assignedUserId && Number(assignedUserId) !== req.session.userId) {
            await sendNotification(
                assignedUserId,
                'info',
                `${req.session.userName || 'Admin'} assigned you to task: ${title}`,
                { taskId: task.id }
            );
        }

        // Get full task details with names
        const fullTask = await query(`
            SELECT t.*, u.name as "assignedUserName", c.name as "createdByName", p.name as "projectName", m.title as "milestoneTitle"
            FROM tasks t
            LEFT JOIN users u ON t."assignedUserId" = u.id
            LEFT JOIN users c ON t."createdBy" = c.id
            LEFT JOIN projects p ON t."projectId" = p.id
            LEFT JOIN milestones m ON t."milestoneId" = m.id
            WHERE t.id = $1
        `, [task.id]);

        // Send Notification to Assignee
        if (assignedUserId && Number(assignedUserId) !== req.session.userId) {
            sendNotification(assignedUserId, 'info', `You were assigned to task: ${fullTask.rows[0].title}`, { taskId: fullTask.rows[0].id });
        }

        res.json(fullTask.rows[0]);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, dueDate, assignedUserId, labels, projectId, milestoneId, loomVideo, workflowLink, workflowStatus } = req.body;
    const currentUserId = req.session.userId;
    const currentUserName = req.session.userName;
    const currentUserRole = req.session.userRole;

    try {
        // Fetch existing task first
        const oldTaskResult = await query('SELECT * FROM tasks WHERE id = $1', [id]);
        const oldTask = oldTaskResult.rows[0];

        if (!oldTask) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // --- Member Completion Rule Validation ---
        if (status === 'done' && oldTask.status !== 'done' && currentUserRole === 'member') {
            if (!workflowLink || !workflowStatus) {
                return res.status(400).json({
                    error: 'Task completion requires details (Workflow Link and Workflow Status).',
                    requireDetails: true
                });
            }
        }

        // Perform Update
        await query(`
            UPDATE tasks 
            SET title = $1, description = $2, status = $3, priority = $4, "dueDate" = $5, 
                "assignedUserId" = $6, labels = $7, "projectId" = $8, "milestoneId" = $9,
                "loomVideo" = $10, "workflowLink" = $11, "workflowStatus" = $12, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $13
        `, [title, description, status, priority, dueDate, assignedUserId, labels, projectId, milestoneId, loomVideo, workflowLink, workflowStatus, id]);

        const taskResult = await query(`
            SELECT t.*, u.name as "assignedUserName", c.name as "createdByName", p.name as "projectName", m.title as "milestoneTitle"
            FROM tasks t
            LEFT JOIN users u ON t."assignedUserId" = u.id
            LEFT JOIN users c ON t."createdBy" = c.id
            LEFT JOIN projects p ON t."projectId" = p.id
            LEFT JOIN milestones m ON t."milestoneId" = m.id
            WHERE t.id = $1
        `, [id]);
        const newTask = taskResult.rows[0];

        // --- Notification Logic ---
        let notificationMessage = '';
        const targetUserId = Number(assignedUserId);
        const currentUserId = req.session.userId;
        const currentUserName = req.session.userName || 'Someone';

        // 1. Assignment Change
        if (oldTask.assignedUserId != assignedUserId) {
            if (targetUserId && targetUserId !== currentUserId) {
                notificationMessage = `${currentUserName} assigned you to task: ${newTask.title}`;
                await sendNotification(targetUserId, 'info', notificationMessage, { taskId: newTask.id });
            }
        }
        // 2. Status Change (notify current assignee or creator)
        else if (oldTask.status !== status) {
            const statusMap = { todo: 'To Do', in_progress: 'In Progress', blocked: 'Blocked', done: 'Done' };
            notificationMessage = `${currentUserName} moved task '${newTask.title}' from ${statusMap[oldTask.status]} to ${statusMap[status]}`;

            const notifyId = oldTask.assignedUserId || (oldTask.createdBy !== currentUserId ? oldTask.createdBy : null);
            if (notifyId && notifyId !== currentUserId) {
                await sendNotification(notifyId, 'info', notificationMessage, { taskId: newTask.id });
            }
        }
        // 3. Priority Change (notify current assignee or creator)
        else if (oldTask.priority !== priority) {
            notificationMessage = `${currentUserName} changed priority of '${newTask.title}' to ${priority}`;

            const notifyId = oldTask.assignedUserId || (oldTask.createdBy !== currentUserId ? oldTask.createdBy : null);
            if (notifyId && notifyId !== currentUserId) {
                await sendNotification(notifyId, 'info', notificationMessage, { taskId: newTask.id });
            }
        }
        // 4. Content Update (Title/Description) - notify current assignee or creator
        else if (oldTask.title !== title || oldTask.description !== description) {
            notificationMessage = `${currentUserName} updated details for task: ${newTask.title}`;

            if (oldTask.assignedUserId && oldTask.assignedUserId !== currentUserId) {
                notifyUserId = oldTask.assignedUserId;
            } else if (!oldTask.assignedUserId && oldTask.createdBy !== currentUserId) {
                notifyUserId = oldTask.createdBy;
            }
        }

        // Send Notification if we have a message and a target user
        if (notificationMessage && notifyUserId) {
            console.log(`[TASK_UPDATE] Sending notification to user ${notifyUserId}: ${notificationMessage}`);
            sendNotification(notifyUserId, 'info', notificationMessage, { taskId: id });
        } else if (notificationMessage) {
            console.log(`[TASK_UPDATE] Notification message created but no target user: "${notificationMessage}"`);
        }

        // Broadcast data update
        io.emit('dataUpdate', { type: 'tasks' });

        res.json(newTask);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.get('/api/tasks/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query(`
            SELECT t.*, u.name as "assignedUserName", c.name as "createdByName", p.name as "projectName", m.title as "milestoneTitle"
            FROM tasks t
            LEFT JOIN users u ON t."assignedUserId" = u.id
            LEFT JOIN users c ON t."createdBy" = c.id
            LEFT JOIN projects p ON t."projectId" = p.id
            LEFT JOIN milestones m ON t."milestoneId" = m.id
            WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = result.rows[0];

        // Members can only see tasks assigned to them, created by them, or if they are admin
        if (req.session.userRole !== 'admin' &&
            task.assignedUserId !== req.session.userId &&
            task.createdBy !== req.session.userId) {
            // Optional: Allow viewing unassigned tasks? Or project tasks?
            // valuable context: existing `GET /api/tasks` filters by assignment/creation.
            // Sticking to strict access for now.
            // actually, "All Tasks" board implies visibility?
            // Let's mirror the `GET /api/tasks` logic essentially:
            // Member sees: assigned to them OR created by them.
            // What about project tasks?
            return res.status(403).json({ error: 'Access denied' });
        }

        // Broadcast data update
        io.emit('dataUpdate', { type: 'tasks' });

        res.json(task);
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Server error' });
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
        const projects = await query(`
            SELECT p.*, 
                   u.name as "managerName",
                   ua.name as "assignedUserName",
                   (SELECT COUNT(*) FROM project_access_items pai WHERE pai."projectId" = p.id AND pai."isGranted" = 0)::int as "pendingAccessCount"
            FROM projects p
            LEFT JOIN users u ON p."managerId" = u.id
            LEFT JOIN users ua ON p."assignedUserId" = ua.id
            ORDER BY p."createdAt" DESC
        `);
        res.json(projects.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching projects' });
    }
});

app.post('/api/projects', requireAdmin, async (req, res) => {
    const { name, client, status, startDate, endDate, description, managerId, assignedUserId, initialTasks } = req.body;

    try {
        const result = await query(`
            INSERT INTO projects (name, client, status, "startDate", "endDate", description, "managerId", "assignedUserId")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [name, client, status || 'active', startDate, endDate, description, managerId || null, assignedUserId || null]);

        const project = result.rows[0];

        // Create initial tasks if provided
        if (initialTasks && Array.isArray(initialTasks) && initialTasks.length > 0) {
            for (const task of initialTasks) {
                if (task.title) {
                    await query(`
                        INSERT INTO tasks (title, status, priority, "createdBy", "projectId")
                        VALUES ($1, 'todo', $2, $3, $4)
                    `, [task.title, task.priority || 'medium', req.session.userId, project.id]);
                }
            }
        }

        // Log creation
        await query(`
            INSERT INTO project_logs ("projectId", type, message, "createdBy")
            VALUES ($1, 'project_update', $2, $3)
        `, [project.id, `Project "${name}" created`, req.session.userId]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error creating project' });
    }
});

app.put('/api/projects/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        // Build dynamic query for partial updates
        const fields = [];
        const values = [];
        let idx = 1;

        const allowedFields = {
            name: 'name',
            client: 'client',
            status: 'status',
            startDate: '"startDate"',
            endDate: '"endDate"',
            description: 'description',
            managerId: '"managerId"',
            assignedUserId: '"assignedUserId"'
        };

        for (const [key, dbCol] of Object.entries(allowedFields)) {
            if (updates[key] !== undefined) {
                fields.push(`${dbCol} = $${idx++}`);
                values.push(updates[key]);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        values.push(id);
        const updateQuery = `
            UPDATE projects 
            SET ${fields.join(', ')}, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $${idx}
            RETURNING *
        `;

        const result = await query(updateQuery, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Log update
        await query(`
            INSERT INTO project_logs ("projectId", type, message, "createdBy")
            VALUES ($1, 'project_update', $2, $3)
        `, [id, `Project updated: ${Object.keys(updates).join(', ')}`, req.session.userId]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Error updating project' });
    }
});

app.delete('/api/projects/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM projects WHERE id = $1', [id]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

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

app.post('/api/projects/:projectId/milestones', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    const { title, dueDate, status, details } = req.body;

    try {
        const maxOrderResult = await query('SELECT MAX("orderIndex") as max FROM milestones WHERE "projectId" = $1', [projectId]);
        const orderIndex = (maxOrderResult.rows[0].max || -1) + 1;

        const result = await query(`
            INSERT INTO milestones ("projectId", title, "dueDate", status, details, "orderIndex")
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [projectId, title, dueDate, status || 'not_started', details, orderIndex]);

        // Log milestone creation
        await query(`
            INSERT INTO project_logs ("projectId", type, message, "createdBy")
            VALUES ($1, 'milestone_update', $2, $3)
        `, [projectId, `Milestone "${title}" created`, req.session.userId]);

        // --- NOTIFICATION LOGIC ---
        // Get project details to find manager and assignee
        const projectResult = await query('SELECT name, "managerId", "assignedUserId" FROM projects WHERE id = $1', [projectId]);
        const project = projectResult.rows[0];

        if (project) {
            const notifMessage = `New milestone "${title}" added to project: ${project.name}`;
            const notifData = { projectId: Number(projectId), milestoneId: result.rows[0].id };

            // 1. Notify Assignee (if not the creator)
            if (project.assignedUserId && project.assignedUserId !== req.session.userId) {
                await sendNotification(project.assignedUserId, 'info', notifMessage, notifData);
            }

            // 2. Notify Manager (if not the creator and different from assignee)
            if (project.managerId && project.managerId !== req.session.userId && project.managerId !== project.assignedUserId) {
                await sendNotification(project.managerId, 'info', notifMessage, notifData);
            }

            // 3. Notify Admins (excluding the creator)
            const adminsResult = await query("SELECT id FROM users WHERE role = 'admin' AND id != $1", [req.session.userId]);
            for (const admin of adminsResult.rows) {
                // Don't double-notify if admin is manager or assignee
                if (admin.id !== project.assignedUserId && admin.id !== project.managerId) {
                    await sendNotification(admin.id, 'info', notifMessage, notifData);
                }
            }
        }

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' }); // Milestones are part of project view

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

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' }); // Milestones are viewed within projects

        res.json(milestone.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating milestone' });
    }
});

app.delete('/api/milestones/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM milestones WHERE id = $1', [id]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

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
        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

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

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json(item.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error updating checklist item' });
    }
});

app.delete('/api/checklist/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM milestone_checklist_items WHERE id = $1', [id]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

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

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

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

app.post('/api/projects/:projectId/access', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    const { platform, description, notes } = req.body;

    try {
        const result = await query(`
            INSERT INTO project_access_items ("projectId", platform, description, notes)
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [projectId, platform, description || null, notes || null]);

        // Log access request
        await query(`
            INSERT INTO project_logs ("projectId", type, message, "createdBy")
            VALUES ($1, 'access_update', $2, $3)
        `, [projectId, `Access requested for ${platform}`, req.session.userId]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating access item:', error);
        res.status(500).json({ error: 'Error creating access item' });
    }
});

app.put('/api/access/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        // Build dynamic query for partial updates
        const fields = [];
        const values = [];
        let idx = 1;

        const allowedFields = {
            platform: 'platform',
            description: 'description',
            isGranted: '"isGranted"',
            grantedEmail: '"grantedEmail"',
            notes: 'notes'
        };

        for (const [key, dbCol] of Object.entries(allowedFields)) {
            if (updates[key] !== undefined) {
                if (key === 'isGranted') {
                    fields.push(`${dbCol} = $${idx++}`);
                    values.push(updates[key]);
                } else {
                    fields.push(`${dbCol} = $${idx++}`);
                    values.push(updates[key]);
                }
            }
        }

        // Auto-set grantedAt when isGranted changes
        if (updates.isGranted !== undefined) {
            fields.push(`"grantedAt" = $${idx++}`);
            values.push(updates.isGranted ? new Date().toISOString() : null);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No valid fields provided for update' });
        }

        values.push(id);
        const updateQuery = `
            UPDATE project_access_items 
            SET ${fields.join(', ')}
            WHERE id = $${idx}
            RETURNING *
        `;

        const result = await query(updateQuery, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Access item not found' });
        }

        const accessItem = result.rows[0];

        // Log access grant/update
        if (updates.isGranted) {
            await query(`
                INSERT INTO project_logs ("projectId", type, message, "createdBy")
                VALUES ($1, 'access_update', $2, $3)
            `, [accessItem.projectId, `Access updated for ${accessItem.platform}`, req.session.userId]);
        }

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json(accessItem);
    } catch (error) {
        console.error('Error updating access item:', error);
        res.status(500).json({ error: 'Error updating access item' });
    }
});

app.delete('/api/access/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await query('DELETE FROM project_access_items WHERE id = $1', [id]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

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

        // Notify admin
        // sendNotification('attendance', `${req.session.userName || 'A user'} just clocked in.`, { userId, type: 'clock_in' });

        // Broadcast data update
        io.emit('dataUpdate', { type: 'attendance' });

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

        const sessionResult = await query('SELECT * FROM attendance WHERE id = $1', [activeSession.id]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'attendance' });

        res.json(sessionResult.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Clock out error' });
    }
});

// ============= FILE UPLOAD ROUTES =============

app.post('/api/upload/image', requireAuth, generalUpload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }
    const imageUrl = `/uploads/descriptions/${req.file.filename}`;
    res.json({ url: imageUrl });
});

app.get('/api/projects/:projectId/files', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    try {
        const result = await query(`
            SELECT pf.*, u.name as "userName"
            FROM project_files pf
            JOIN users u ON pf."uploadedBy" = u.id
            WHERE pf."projectId" = $1
            ORDER BY pf."createdAt" DESC
        `, [projectId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching project files' });
    }
});

app.post('/api/projects/:projectId/files', requireAuth, generalUpload.single('projectFile'), async (req, res) => {
    const { projectId } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const filePath = `/uploads/projects/${projectId}/files/${req.file.filename}`;
        const result = await query(`
            INSERT INTO project_files ("projectId", name, path, "uploadedBy")
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [projectId, req.file.originalname, filePath, req.session.userId]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error saving file info' });
    }
});

app.delete('/api/projects/:projectId/files/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const fileResult = await query('SELECT * FROM project_files WHERE id = $1', [id]);
        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = fileResult.rows[0];
        const fullPath = path.join(__dirname, 'public', file.path);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        await query('DELETE FROM project_files WHERE id = $1', [id]);

        // Broadcast data update
        io.emit('dataUpdate', { type: 'projects' });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting file' });
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

app.get('/api/attendance/admin/history', requireAdmin, async (req, res) => {
    const { limit = 100 } = req.query;
    try {
        const records = await query(`
            SELECT a.*, u.name as "userName", u.email as "userEmail"
            FROM attendance a
            JOIN users u ON a."userId" = u.id
            ORDER BY a."clockInTime" DESC
            LIMIT $1
        `, [limit]);
        res.json(records.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching all attendance history' });
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
                { email: 'admin@sloraai.com', password: 'admin123', role: 'admin' },
                { email: 'member@sloraai.com', password: 'member123', role: 'member' }
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
        const adminResult = await query('SELECT * FROM users WHERE email = $1', ['admin@sloraai.com']);
        if (!adminResult.rows[0]) {
            console.log('🌱 Seed: Creating Admin...');
            const adminPassword = await bcrypt.hash('admin123', 10);
            const adminUserResult = await query(`
                INSERT INTO users (email, password, name, role, active)
                VALUES ($1, $2, $3, $4, 1) RETURNING *
            `, ['admin@sloraai.com', adminPassword, 'Admin User', 'admin']);
            const adminUser = adminUserResult.rows[0];
            // ...
            console.log('🌱 Seed: Creating Member...');
            const memberPassword = await bcrypt.hash('member123', 10);
            await query(`
                INSERT INTO users (email, password, name, role, active)
                VALUES ($1, $2, $3, $4, 1)
            `, ['member@sloraai.com', memberPassword, 'Team Member', 'member']);

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
                await query('UPDATE users SET active = 1 WHERE email = $1', ['admin@sloraai.com']);
            }
        }
    } catch (error) {
        console.error('Auto-seed failed:', error);
    }
}

// -------------------------------------------------------------------------
// NOTIFICATION SYSTEM (Moved here to be AFTER session middleware)
// -------------------------------------------------------------------------

// Helper to send notifications
async function sendNotification(userId, type, message, data = {}) {
    console.log(`[DEEP_DEBUG] sendNotification called for User ${userId}, Message: ${message}`);
    try {
        // Save to database
        const result = await query(
            'INSERT INTO notifications ("userId", type, message, data, "isRead") VALUES ($1, $2, $3, $4, 0) RETURNING *',
            [userId, type, message, JSON.stringify(data)]
        );

        console.log(`[DEEP_DEBUG] Notification saved to DB with ID: ${result.rows[0].id}`);

        const notification = result.rows[0];

        // Emit to specific user via Socket.io
        const roomName = `user:${userId}`;
        console.log(`[DEEP_DEBUG] Emitting socket event 'notification' to room: ${roomName}`);
        io.to(roomName).emit('notification', notification);

    } catch (err) {
        console.error('[DEEP_DEBUG] Failed to send notification:', err);
    }
}

// Notification APIs
app.get('/api/notifications', requireAuth, async (req, res) => {
    console.log(`[NOTIFICATIONS] Fetching for user ${req.session.userId}`);
    try {
        const result = await query(
            'SELECT * FROM notifications WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50',
            [req.session.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Notification Fetch Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/read', requireAuth, async (req, res) => {
    try {
        await query(
            'UPDATE notifications SET "isRead" = 1 WHERE "userId" = $1',
            [req.session.userId]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============= IDEATION ROUTES =============

app.get('/api/ideation', requireAuth, async (req, res) => {
    try {
        const result = await query(`
            SELECT ib.*, p.name as "projectName"
            FROM ideation_boards ib
            LEFT JOIN projects p ON ib."projectId" = p.id
            WHERE ib."userId" = $1
            ORDER BY ib."updatedAt" DESC
        `, [req.session.userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching ideation boards:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/ideation/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query(`
            SELECT ib.*, p.name as "projectName"
            FROM ideation_boards ib
            LEFT JOIN projects p ON ib."projectId" = p.id
            WHERE ib.id = $1 AND ib."userId" = $2
        `, [id, req.session.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Board not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching ideation board:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/ideation', requireAuth, async (req, res) => {
    const { name, projectId, data, type } = req.body;
    try {
        const result = await query(`
            INSERT INTO ideation_boards (name, "projectId", "userId", data, type)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [name, projectId || null, req.session.userId, JSON.stringify(data || {}), type || 'mindmap']);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating ideation board:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/ideation/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { name, projectId, data } = req.body;
    try {
        const result = await query(`
            UPDATE ideation_boards 
            SET name = COALESCE($1, name),
                "projectId" = $2,
                data = COALESCE($3, data),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $4 AND "userId" = $5
            RETURNING *
        `, [name, projectId || null, data ? JSON.stringify(data) : null, id, req.session.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Board not found or unauthorized' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating ideation board:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/ideation/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM ideation_boards WHERE id = $1 AND "userId" = $2 RETURNING id', [id, req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Board not found or unauthorized' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting ideation board:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============= TRANSCRIPTION ROUTES =============

app.get('/api/projects/:projectId/transcriptions', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    try {
        const result = await query(`
            SELECT pt.*, u.name as "createdByName"
            FROM project_transcriptions pt
            LEFT JOIN users u ON pt."createdBy" = u.id
            WHERE pt."projectId" = $1
            ORDER BY pt."createdAt" DESC
        `, [projectId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transcriptions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/projects/:projectId/transcriptions', requireAuth, async (req, res) => {
    const { projectId } = req.params;
    const { title, content } = req.body;

    try {
        const result = await query(`
            INSERT INTO project_transcriptions ("projectId", title, content, "createdBy")
            VALUES ($1, $2, $3, $4) RETURNING *
        `, [projectId, title, content, req.session.userId]);

        // Log activity
        await query(`
            INSERT INTO project_logs ("projectId", type, message, "createdBy")
            VALUES ($1, 'project_update', $2, $3)
        `, [projectId, `Added transcription: ${title}`, req.session.userId]);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating transcription:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Next.js Request Handler
app.all(/(.*)/, (req, res) => {
    return handle(req, res);
});

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    console.error('🔥 CRITICAL SERVER ERROR:', err);
    res.status(500).json({
        error: 'Critical Server Error',
        message: err.message,
        location: 'Global Handler'
    });
});

nextApp.prepare().then(() => {
    server.on('error', (err) => {
        console.error('❌ Server Listen Error:', err);
        require('fs').writeFileSync('server_error.log', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        process.exit(1);
    });

    server.listen(PORT, async () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);

        try {
            console.log('🔄 Initializing database...');
            const dbUrl = process.env.DATABASE_URL || '';
            console.log(`[SERVER-DEBUG] DATABASE_URL length: ${dbUrl.length}`);
            console.log(`[SERVER-DEBUG] DATABASE_URL start: ${dbUrl.substring(0, 10)}...`);

            await initializeDatabase();
            console.log('✅ Database initialized.');

            await seedDatabase();
            console.log(`✅ Database seeded.`);

            // Ensure upload directories exist
            const uploadDirs = [
                path.join(__dirname, 'public', 'uploads', 'descriptions'),
                path.join(__dirname, 'public', 'uploads', 'projects'),
                path.join(__dirname, 'public', 'uploads', 'profiles'),
            ];
            uploadDirs.forEach(dir => {
                if (!require('fs').existsSync(dir)) {
                    require('fs').mkdirSync(dir, { recursive: true });
                    console.log(`📁 Created directory: ${dir}`);
                }
            });

            console.log(`📝 Login at http://localhost:${PORT}\n`);
        } catch (error) {
            console.error('❌ Failed to initialize database:', error);
            const fs = require('fs');
            fs.writeFileSync('error.log', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            if (error instanceof AggregateError) {
                console.error('AggregateError details:', error.errors);
                error.errors.forEach(e => console.error(e));
                fs.appendFileSync('error.log', '\n' + JSON.stringify(error.errors, null, 2));
            }
            startupError = error;
            // Do NOT process.exit(1) - keep server running to show error page
        }
    });
}).catch((err) => {
    console.error('❌ Next.js Prepare Error:', err);
    process.exit(1);
});
