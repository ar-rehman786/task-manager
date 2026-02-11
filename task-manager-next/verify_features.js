const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const jar = new CookieJar();
const client = wrapper(axios.create({
    baseURL: 'http://localhost:3000',
    jar,
    validateStatus: () => true // Don't throw on 4xx/5xx
}));

async function verify() {
    console.log('🔍 Starting Feature Verification...\n');
    const results = {};

    // 1. Check Public Pages
    console.log('1️⃣  Checking Public Pages');
    const loginPage = await client.get('/login');
    console.log(`- GET /login: ${loginPage.status} ${loginPage.status === 200 ? '✅' : '❌'}`);
    results.loginPage = loginPage.status === 200;

    // 2. Authentication
    console.log('\n2️⃣  Authentication');
    const loginRes = await client.post('/api/auth/login', {
        email: 'admin@sloraai.com',
        password: 'admin123'
    });
    console.log(`- POST /api/auth/login: ${loginRes.status}`);
    if (loginRes.status === 200) {
        console.log('  ✅ Login successful');
        results.auth = true;
    } else {
        console.log('  ❌ Login failed:', loginRes.data);
        process.exit(1);
    }

    // 3. User & Profile
    console.log('\n3️⃣  User Profile');
    const meRes = await client.get('/api/auth/me');
    console.log(`- GET /api/auth/me: ${meRes.status}`);
    if (meRes.status === 200 && meRes.data.email === 'admin@sloraai.com') {
        console.log('  ✅ Profile verified');
        results.profile = true;
    } else {
        console.log('  ❌ Profile check failed');
    }

    // 4. Dashboard Access (Protected Page)
    console.log('\n4️⃣  Dashboard Access');
    const dashRes = await client.get('/dashboard');
    // Next.js might redirect to login if no cookie, but we have cookie.
    // It should return 200 OK HTML.
    console.log(`- GET /dashboard: ${dashRes.status}`);
    results.dashboard = dashRes.status === 200;

    // 5. Data Endpoints (Projects, Tasks, Team)
    console.log('\n5️⃣  Data Features');

    const projectsRes = await client.get('/api/projects');
    console.log(`- GET /api/projects: ${projectsRes.status} (Count: ${Array.isArray(projectsRes.data) ? projectsRes.data.length : 'N/A'})`);
    results.projects = projectsRes.status === 200;

    const tasksRes = await client.get('/api/tasks');
    console.log(`- GET /api/tasks: ${tasksRes.status} (Count: ${Array.isArray(tasksRes.data) ? tasksRes.data.length : 'N/A'})`);
    results.tasks = tasksRes.status === 200;

    const usersRes = await client.get('/api/users');
    console.log(`- GET /api/users: ${usersRes.status} (Count: ${Array.isArray(usersRes.data) ? usersRes.data.length : 'N/A'})`);
    results.team = usersRes.status === 200;

    const boardsRes = await client.get('/api/boards');
    console.log(`- GET /api/boards: ${boardsRes.status}`);
    results.boards = boardsRes.status === 200;

    console.log('\n🏁 Verification Summary:');
    console.table(results);
}

verify().catch(console.error);
