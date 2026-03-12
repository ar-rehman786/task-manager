const axios = require('axios');

const API_URL = 'http://localhost:3000';

async function testRoutes() {
    const routes = [
        '/api/projects',
        '/api/tasks',
        '/api/team-members'
    ];

    console.log('--- Testing Routes Without Session ---');
    for (const route of routes) {
        try {
            const response = await axios.get(`${API_URL}${route}`);
            console.log(`❌ ${route}: Expected 401, got ${response.status}`);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`✅ ${route}: Correctly returned 401 Unauthorized`);
            } else {
                console.log(`❌ ${route}: Unexpected error - ${error.message}`);
            }
        }
    }

    console.log('\n--- Testing Login ---');
    try {
        const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
            email: 'admin@sloraai.com',
            password: 'admin123'
        });
        const cookie = loginResponse.headers['set-cookie'];
        console.log('✅ Login successful');
        console.log('Cookie:', cookie);

        console.log('\n--- Testing Routes With Session ---');
        for (const route of routes) {
            try {
                const response = await axios.get(`${API_URL}${route}`, {
                    headers: { Cookie: cookie[0].split(';')[0] }
                });
                console.log(`✅ ${route}: Returned ${response.status} OK`);
            } catch (error) {
                console.log(`❌ ${route}: Failed with ${error.response?.status || error.message}`);
                if (error.response?.data) {
                    console.log('Response data:', error.response.data);
                }
            }
        }
    } catch (error) {
        console.log(`❌ Login failed: ${error.message}`);
    }
}

testRoutes();
