require('dotenv').config();
const { Client } = require('pg');

async function verify() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected');

        // 1. Check if the project "Matthew" (ID 2) exists
        const projectRes = await client.query('SELECT * FROM projects WHERE id = 2');
        if (projectRes.rows.length === 0) {
            console.log('❌ Project Matthew (ID 2) not found. Skipping verification.');
            return;
        }

        // 2. Create a test milestone for Project 2
        console.log('Creating test milestone...');
        const milestoneRes = await client.query(`
            INSERT INTO milestones ("projectId", title, status)
            VALUES (2, 'Verification Milestone', 'not_started') RETURNING id
        `);
        const milestoneId = milestoneRes.rows[0].id;
        console.log(`Created milestone ID: ${milestoneId}`);

        // 3. Create a test task for Project 2 assigned to this milestone
        console.log('Creating test task...');
        // Need to find a valid userId for createdBy/assignedUserId
        const userRes = await client.query('SELECT id FROM users LIMIT 1');
        const userId = userRes.rows[0].id;

        const taskRes = await client.query(`
            INSERT INTO tasks (title, "projectId", "milestoneId", "assignedUserId", "createdBy", status, priority)
            VALUES ('Verification Task', 2, $1, $2, $2, 'todo', 'medium') RETURNING id
        `, [milestoneId, userId]);
        const taskId = taskRes.rows[0].id;
        console.log(`Created task ID: ${taskId}`);

        // 4. Verify the new API route
        console.log('Verifying GET /api/projects/2/tasks route...');
        // We can't hit the API directly easily with auth without a lot of setup,
        // but we can simulate the query used in server.js
        const finalCheck = await client.query(`
            SELECT t.*, u.name as "assignedUserName", m.title as "milestoneTitle"
            FROM tasks t
            LEFT JOIN users u ON t."assignedUserId" = u.id
            LEFT JOIN milestones m ON t."milestoneId" = m.id
            WHERE t."projectId" = 2 AND t."milestoneId" = $1
        `, [milestoneId]);

        if (finalCheck.rows.length > 0) {
            console.log('✅ Task successfully found for milestone!');
            console.log(JSON.stringify(finalCheck.rows[0], null, 2));
        } else {
            console.log('❌ Task NOT found for milestone!');
        }

    } catch (err) {
        console.error('❌ Verification Error:', err);
    } finally {
        await client.end();
        process.exit();
    }
}

verify();
