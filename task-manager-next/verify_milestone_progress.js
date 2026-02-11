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

        // 1. Find a project and a milestone
        const projectRes = await client.query('SELECT id FROM projects LIMIT 1');
        if (projectRes.rows.length === 0) {
            console.log('❌ No projects found.');
            return;
        }
        const projectId = projectRes.rows[0].id;

        const milestoneRes = await client.query('SELECT id FROM milestones WHERE "projectId" = $1 LIMIT 1', [projectId]);
        if (milestoneRes.rows.length === 0) {
            console.log('Creating test milestone...');
            const newMilestone = await client.query('INSERT INTO milestones ("projectId", title) VALUES ($1, $2) RETURNING id', [projectId, 'Test Milestone']);
            milestoneId = newMilestone.rows[0].id;
        } else {
            milestoneId = milestoneRes.rows[0].id;
        }

        console.log(`Using milestone ID: ${milestoneId}`);

        // 2. Clear old test tasks if any (optional, but let's just add new ones)
        const userRes = await client.query('SELECT id FROM users LIMIT 1');
        const userId = userRes.rows[0].id;

        console.log('Adding test tasks...');
        await client.query('INSERT INTO tasks (title, "projectId", "milestoneId", "assignedUserId", "createdBy", status) VALUES ($1, $2, $3, $4, $4, $5)',
            ['Task 1', projectId, milestoneId, userId, 'done']);
        await client.query('INSERT INTO tasks (title, "projectId", "milestoneId", "assignedUserId", "createdBy", status) VALUES ($1, $2, $3, $4, $4, $5)',
            ['Task 2', projectId, milestoneId, userId, 'todo']);

        // 3. Verify the query used in server.js
        console.log('Verifying milestone progress query...');
        const finalCheck = await client.query(`
            SELECT m.id, m.title,
                   (SELECT COUNT(*) FROM tasks t WHERE t."milestoneId" = m.id)::int as "totalTasks",
                   (SELECT COUNT(*) FROM tasks t WHERE t."milestoneId" = m.id AND t.status = 'done')::int as "completedTasks"
            FROM milestones m
            WHERE m.id = $1
        `, [milestoneId]);

        const result = finalCheck.rows[0];
        console.log('Query result:', JSON.stringify(result, null, 2));

        if (result.totalTasks >= 2 && result.completedTasks >= 1) {
            console.log('✅ Milestone progress correctly calculated!');
        } else {
            console.log('❌ Milestone progress calculation mismatch!');
        }

    } catch (err) {
        console.error('❌ Verification Error:', err);
    } finally {
        await client.end();
        process.exit();
    }
}

verify();
