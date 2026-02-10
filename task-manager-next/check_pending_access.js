const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:QQvhFwugKDKBqzHjxQqjCHGGvDHcBfEg@interchange.proxy.rlwy.net:58280/railway',
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkData() {
    try {
        console.log('Using DB URL: postgresql://postgres:QQvhFwugKDKBqzHjxQqjCHGGvDHcBfEg@interchange.proxy.rlwy.net:58280/railway');

        const clients = await pool.query('SELECT * FROM project_access_items');
        console.log('Total Access Items:', clients.rows.length);
        console.log('Access Items:', JSON.stringify(clients.rows, null, 2));

        const projects = await pool.query(`
            SELECT p.id, p.name, 
            (SELECT COUNT(*) FROM project_access_items pai WHERE pai."projectId" = p.id AND pai."isGranted" = 0)::int as "rawCount"
            FROM projects p
        `);
        console.log('Projects with raw counts:', JSON.stringify(projects.rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkData();
