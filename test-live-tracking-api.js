const axios = require('axios');

async function testLiveTrackingAPI() {
  try {
    console.log('Testing Live Tracking API endpoints...\n');
    
    // First, we need to login to get a token
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'admin@fixithub.com',
      password: 'admin123'
    });
    
    if (loginResponse.status !== 200) {
      console.error('Login failed:', loginResponse.status, loginResponse.data);
      return;
    }
    
    const token = loginResponse.data.accessToken || loginResponse.data.data?.accessToken;
    console.log('✅ Login successful, token received\n');
    
    // Test summary endpoint
    console.log('2. Testing summary endpoint...');
    const summaryResponse = await axios.get('http://localhost:3000/api/admin/live-tracking/summary?minutes=30', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Status:', summaryResponse.status);
    console.log('Content-Type:', summaryResponse.headers['content-type']);
    console.log('Response data:', JSON.stringify(summaryResponse.data, null, 2));
    console.log('');
    
    // Test active sessions endpoint
    console.log('3. Testing active sessions endpoint...');
    const sessionsResponse = await axios.get('http://localhost:3000/api/admin/live-tracking/active-sessions?minutes=30', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Status:', sessionsResponse.status);
    console.log('Content-Type:', sessionsResponse.headers['content-type']);
    console.log('Sessions count:', Array.isArray(sessionsResponse.data) ? sessionsResponse.data.length : 'not an array');
    if (Array.isArray(sessionsResponse.data) && sessionsResponse.data.length > 0) {
      console.log('First session:', JSON.stringify(sessionsResponse.data[0], null, 2));
    }
    console.log('');
    
    console.log('✅ API tests completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testLiveTrackingAPI();
