const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  try {
    console.log('\n--- ATTENDANCE DATA CHECK ---');
    const attendance = await pool.query(`
      SELECT a.id, a."userId", a."clientId", a."clockInTime", a.status, a."workDuration"
      FROM attendance a 
      ORDER BY a."clockInTime" DESC 
      LIMIT 20
    `);
    console.table(attendance.rows);

    console.log('\n--- CLIENTS TABLE ---');
    const clients = await pool.query('SELECT id, name FROM clients');
    console.table(clients.rows);

    console.log('\n--- PROJECTS TABLE ---');
    const projects = await pool.query('SELECT id, name, "clientId" FROM projects');
    console.table(projects.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

debug();
