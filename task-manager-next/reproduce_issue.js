require('dotenv').config();
const { Client } = require('pg');

async function reproduce() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected');

        // 1. Create a test milestone
        console.log('Adding test milestone...');
        const res1 = await client.query(`
            INSERT INTO milestones ("projectId", title, status)
            VALUES (2, 'Reproduction Test', 'not_started') RETURNING id
        `);
        const id = res1.rows[0].id;
        console.log(`Created milestone ID: ${id}`);

        // 2. Update with large base64
        console.log('Updating with large base64 image data...');
        const largeData = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024 * 5); // 5MB
        await client.query(`
            UPDATE milestones SET details = $1 WHERE id = $2
        `, [largeData, id]);
        console.log('Update successful');

        // 3. Verify
        const res2 = await client.query('SELECT id, title FROM milestones WHERE id = $1', [id]);
        if (res2.rows.length > 0) {
            console.log('✅ Milestone still exists after large update');
        } else {
            console.log('❌ Milestone GONE after update!');
        }

    } catch (err) {
        console.error('❌ Reproduction Error:', err);
    } finally {
        await client.end();
        process.exit();
    }
}

reproduce();
