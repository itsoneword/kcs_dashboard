#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testLogin(email, password, attempts = 1) {
    console.log(`\n=== Testing Login (Attempt ${attempts}) ===`);
    console.log(`Email: ${email}`);
    console.log(`Time: ${new Date().toISOString()}`);

    try {
        const response = await axios.post(`${API_BASE}/auth/login`, {
            email,
            password
        });

        console.log('✅ Login successful!');
        console.log('User:', response.data.user.name);
        console.log('Token length:', response.data.token.length);

        return response.data.token;
    } catch (error) {
        console.log('❌ Login failed!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
        console.log('Rate limit headers:');
        console.log('  Limit:', error.response?.headers['x-ratelimit-limit']);
        console.log('  Remaining:', error.response?.headers['x-ratelimit-remaining']);
        console.log('  Reset:', error.response?.headers['x-ratelimit-reset']);

        throw error;
    }
}

async function testLogout(token) {
    console.log('\n=== Testing Logout ===');

    try {
        await axios.post(`${API_BASE}/auth/logout`, {}, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('✅ Logout successful!');
    } catch (error) {
        console.log('❌ Logout failed!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
    }
}

async function testHealthCheck() {
    console.log('\n=== Testing Health Check ===');

    try {
        const response = await axios.get('http://localhost:3000/health');
        console.log('✅ Health check successful!');
        console.log('Status:', response.data.status);
        console.log('Database:', response.data.database);
    } catch (error) {
        console.log('❌ Health check failed!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
    }
}

async function runTest() {
    console.log('🧪 Starting Login Test Suite');

    // Test health first
    await testHealthCheck();

    // Test credentials - update these with your actual test user
    const email = 'admin@test.com';
    const password = 'password123';

    try {
        // Test multiple login/logout cycles
        for (let i = 1; i <= 10; i++) {
            const token = await testLogin(email, password, i);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
            await testLogout(token);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        }

        console.log('\n🎉 All tests completed successfully!');
    } catch (error) {
        console.log('\n💥 Test failed at some point');
        console.log('Final error:', error.message);
    }
}

// Run the test
runTest().catch(console.error); 