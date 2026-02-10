// const fetch = require('node-fetch'); // Node 22 has global fetch

// Need a valid session cookie for requireAuth... 
// actually, it's easier to just temporarily modify server.js to bypass auth or use the existing session if I can get it.
// Or, I can use the existing `test-db.js` approach but hitting the API.
// Wait, hitting the API requires auth. 
// Maybe I can just use the `check_pending_access.js` script approach (direct DB) to see if INSERT works manually?
// If manual INSERT works, then it's the route handler logic or req.body processing.

// Let's try to simulate the request locally.
// I'll grab the cookie from the user? No, I can't.
// I'll login first with 'admin' then use the cookie.

const API_URL = 'http://localhost:3000/api';

async function testAccessRequest() {
    // 1. Login
    const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'admin' })
    });

    if (!loginRes.ok) {
        console.error('Login failed:', loginRes.status, loginRes.statusText);
        const text = await loginRes.text();
        console.error('Response:', text);
        return;
    }

    const cookies = loginRes.headers.get('set-cookie');
    console.log('Logged in, got cookies');

    // 2. Request Access for Project 1
    const res = await fetch(`${API_URL}/projects/1/access`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
        },
        body: JSON.stringify({
            platform: 'Test Platform via Script',
            description: 'Testing 500 error',
            notes: 'Debug notes'
        })
    });

    console.log('Response Status:', res.status);
    const data = await res.json();
    console.log('Response Body:', data);
}

testAccessRequest();
