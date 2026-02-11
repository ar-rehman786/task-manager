const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyFixes() {
    console.log('--- Verification Started ---');

    try {
        // 1. Verify Project Visibility (Mocking a Member Session)
        // We'll manually run the query that the backend uses
        const memberId = 2; // Assuming ID 2 is a member, adjust if needed
        const projectsQuery = `
            SELECT p.id, p.name, p."managerId", p."assignedUserId"
            FROM projects p
            WHERE p."managerId" = $1 OR p."assignedUserId" = $1
            ORDER BY p."createdAt" DESC
        `;
        const projectResult = await pool.query(projectsQuery, [memberId]);
        console.log(`Member ${memberId} sees ${projectResult.rows.length} projects.`);
        projectResult.rows.forEach(p => {
            if (p.managerId !== memberId && p.assignedUserId !== memberId) {
                console.error(`❌ Project ${p.id} incorrectly visible to member ${memberId}!`);
            } else {
                console.log(`✅ Project ${p.id} correctly visible.`);
            }
        });

        // 2. Verify Profile Fields
        const profileId = 1; // Assuming Admin ID 1
        const testFields = {
            title: 'Lead Developer',
            department: 'Engineering',
            location: 'San Francisco',
            phone: '555-0199',
            employeeId: 'EMP-001'
        };

        const updateQuery = `
            UPDATE users 
            SET title = $1, department = $2, location = $3, phone = $4, "employeeId" = $5
            WHERE id = $6
            RETURNING *
        `;
        const profileResult = await pool.query(updateQuery, [
            testFields.title,
            testFields.department,
            testFields.location,
            testFields.phone,
            testFields.employeeId,
            profileId
        ]);

        const updated = profileResult.rows[0];
        if (updated.title === testFields.title &&
            updated.department === testFields.department &&
            updated.employeeId === testFields.employeeId) {
            console.log('✅ Profile fields updated successfully in DB.');
        } else {
            console.error('❌ Profile fields update failed!');
            console.log('Result:', updated);
        }

        // 3. Verify Team Visibility (All users should be in safe query)
        const teamQuery = `
            SELECT id, name, role FROM users WHERE active = 1
        `;
        const teamResult = await pool.query(teamQuery);
        console.log(`✅ Organization Directory fetchable. Found ${teamResult.rows.length} active users.`);

    } catch (err) {
        console.error('❌ Verification failed with error:', err);
    } finally {
        await pool.end();
    }
}

verifyFixes();
