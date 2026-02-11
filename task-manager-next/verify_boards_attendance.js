const { query } = require('./database.js');

async function verify() {
    console.log('--- START VERIFICATION ---');

    // 1. Verify Boards
    const memberId = 2; // Team Member
    const adminId = 1; // Admin User (regular)

    console.log('\n-- Boards for Member (ID 2) --');
    const memberBoards = await query(`
        SELECT b.id, b.workspace, 'My Tasks' as name, b.type, b."ownerUserId"
        FROM boards b
        JOIN users u ON b."ownerUserId" = u.id
        WHERE b.workspace = $1 
        AND b."ownerUserId" = $2
        AND u.active = 1
        LIMIT 1
    `, ['tasks', memberId]);
    console.log(JSON.stringify(memberBoards.rows, null, 2));

    console.log('\n-- Boards for Admin (Regular) --');
    const adminBoards = await query(`
        SELECT b.* 
        FROM boards b
        JOIN users u ON b."ownerUserId" = u.id
        WHERE b.workspace = $1 
        AND u.role = 'member'
        AND u.active = 1
        ORDER BY b.name
    `, ['tasks']);
    console.log(`Found ${adminBoards.rows.length} boards. All should have owners with role='member'.`);
    adminBoards.rows.forEach(b => {
        console.log(`- Board: ${b.name}, OwnerID: ${b.ownerUserId}`);
    });

    // 2. Verify Attendance Visibility
    const superAdminEmail = 'abdulrehmanhameed4321@gmail.com';
    const regularAdminEmail = 'admin@sloraai.com';

    console.log('\n-- Attendance History for Super Admin --');
    const superAdminRecords = await query(`
        SELECT a.*, u.name as "userName", u.email as "userEmail", u.role
        FROM attendance a
        JOIN users u ON a."userId" = u.id
        ORDER BY a."clockInTime" DESC
        LIMIT 5
    `);
    console.log(`Super Admin sees roles: ${[...new Set(superAdminRecords.rows.map(r => r.role))].join(', ')}`);

    console.log('\n-- Attendance History for Regular Admin --');
    const regAdminRecords = await query(`
        SELECT a.*, u.name as "userName", u.email as "userEmail", u.role
        FROM attendance a
        JOIN users u ON a."userId" = u.id
        WHERE u.role = 'member'
        ORDER BY a."clockInTime" DESC
        LIMIT 5
    `);
    console.log(`Regular Admin sees roles: ${[...new Set(regAdminRecords.rows.map(r => r.role))].join(', ')}`);

    // 3. Verify Shift Logic (Query Test)
    console.log('\n-- Shift Logic Test --');
    // We create a temp view or just test the logic with a sample record if exists
    const shiftTest = await query(`
        SELECT 
            "clockInTime",
            (CASE 
                WHEN EXTRACT(HOUR FROM "clockInTime") >= 12 THEN CAST("clockInTime" AS DATE)
                ELSE CAST("clockInTime" - INTERVAL '1 day' AS DATE)
            END) as shift_date
        FROM attendance
        LIMIT 5
    `);
    console.log('Sample Shift Assignments:');
    shiftTest.rows.forEach(r => {
        console.log(`ClockIn: ${r.clockInTime} -> ShiftDate: ${r.shift_date}`);
    });

    console.log('\n--- VERIFICATION COMPLETE ---');
    process.exit();
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
