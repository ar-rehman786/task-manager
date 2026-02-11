const { query } = require('./database.js');

async function debugData() {
    try {
        console.log('--- Projects ---');
        const projects = await query("SELECT id, name FROM projects WHERE id = 2");
        console.log(JSON.stringify(projects.rows, null, 2));

        if (projects.rows.length > 0) {
            const projectId = projects.rows[0].id;
            console.log(`--- Milestones for Project ${projectId} ---`);
            const milestones = await query('SELECT * FROM milestones WHERE "projectId" = $1', [projectId]);
            console.log(JSON.stringify(milestones.rows, null, 2));

            for (const milestone of milestones.rows) {
                console.log(`--- Checklist for Milestone ${milestone.id} ---`);
                const checklist = await query('SELECT * FROM milestone_checklist_items WHERE "milestoneId" = $1', [milestone.id]);
                console.log(JSON.stringify(checklist.rows, null, 2));
            }
        }
    } catch (err) {
        console.error('Debug error:', err);
    } finally {
        process.exit();
    }
}

debugData();
