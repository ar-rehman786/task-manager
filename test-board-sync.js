
// dynamic import
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testBoardSync() {
    try {
        // 1. Login as Admin
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@taskmanager.com', password: 'admin123' })
        });
        const loginData = await loginRes.json();
        const cookie = loginRes.headers.get('set-cookie');
        console.log('Logged in as:', loginData.name);

        // 2. Get initial boards
        const initialBoardsRes = await fetch('http://localhost:3000/api/boards', {
            headers: { 'Cookie': cookie }
        });
        const initialBoards = await initialBoardsRes.json();
        console.log('Initial Boards Count:', initialBoards.length);

        // 3. Create a temporary user who will have a board
        const userRes = await fetch('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
            body: JSON.stringify({ name: 'Temp User', email: `temp${Date.now()}@test.com`, password: 'password', role: 'member' })
        });
        const newUser = await userRes.json();
        console.log('Created Temp User:', newUser.name);

        // 4. Verify board exists
        const boardsAfterCreateRes = await fetch('http://localhost:3000/api/boards', { headers: { 'Cookie': cookie } });
        const boardsAfterCreate = await boardsAfterCreateRes.json();
        const userBoard = boardsAfterCreate.find(b => b.ownerUserId === newUser.id);

        if (userBoard) {
            console.log('Board found for active user: PASS');
        } else {
            console.error('Board NOT found for active user: FAIL');
        }

        // 5. Deactivate User (Simulate by updating active = 0 directly if API allows, or via delete endpoint which sets active=0)
        // The delete endpoint sets active = 0
        await fetch(`http://localhost:3000/api/users/${newUser.id}`, {
            method: 'DELETE',
            headers: { 'Cookie': cookie }
        });
        console.log('Deactivated Temp User');

        // 6. Verify board is GONE
        const boardsAfterDeactivateRes = await fetch('http://localhost:3000/api/boards', { headers: { 'Cookie': cookie } });
        const boardsAfterDeactivate = await boardsAfterDeactivateRes.json();
        const userBoardGone = !boardsAfterDeactivate.find(b => b.ownerUserId === newUser.id);

        if (userBoardGone) {
            console.log('Board hidden for inactive user: PASS');
        } else {
            console.error('Board STILL VISIBLE for inactive user: FAIL');
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

testBoardSync();
