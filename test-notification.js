// dynamic import
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testNotification() {
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

        // 2. Create a Task
        const createRes = await fetch('http://localhost:3000/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
            body: JSON.stringify({ title: 'Test Task for Notifications', priority: 'medium' })
        });
        const task = await createRes.json();
        console.log('Created task:', task.id);

        // 3. Update Status (Should trigger notification if assigned to someone else, but here we are self-assigning or unassigned)
        // To test real notification we'd need two users. For now, we just check the server log or response.
        // Actually, let's assign it to member user to trigger it.

        const memberRes = await fetch('http://localhost:3000/api/users', {
            headers: { 'Cookie': cookie }
        });
        const users = await memberRes.json();
        const member = users.find(u => u.email === 'member@taskmanager.com');

        if (member) {
            console.log('Assigning to member:', member.name);
            const updateRes = await fetch(`http://localhost:3000/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
                body: JSON.stringify({
                    title: 'Test Task for Notifications',
                    status: 'in_progress', // Change status
                    priority: 'medium',
                    assignedUserId: member.id
                })
            });
            const updatedTask = await updateRes.json();
            console.log('Task updated. Status:', updatedTask.status);
            console.log('If server logs show [DEEP_DEBUG] sendNotification with correct message, then success.');
        } else {
            console.log('Member user not found, cannot test cross-user notification.');
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

testNotification();
