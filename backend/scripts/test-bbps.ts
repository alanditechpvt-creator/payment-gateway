
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:4100/api';
const EMAIL = 'admin@newweb.com';
const PASSWORD = 'Admin@123456';

async function testBBPS() {
  try {
    console.log('1. Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    });

    const token = loginRes.data.data.accessToken;
    const userId = loginRes.data.data.user.id;
    console.log('✅ Login successful. Token obtained.');
    console.log(`User ID: ${userId}`);

    // Set auth header
    const headers = { Authorization: `Bearer ${token}` };

    console.log('\n2. Fetching Bill...');
    const fetchParams = {
      category: 'CREDIT_CARD',
      mobileNumber: '9876543210',
      cardLast4: '1234',
    };

    const fetchRes = await axios.post(`${API_URL}/bbps/fetch`, fetchParams, { headers });
    console.log('✅ Bill Fetched Successfully:');
    console.log(JSON.stringify(fetchRes.data, null, 2));

    const billData = fetchRes.data.data;

    console.log('\n3. Getting Available PGs...');
    // We need a PG ID for payment. Let's fetch available PGs (assuming there's an endpoint or we pick one if we know IDs)
    // Based on previous context, there might be /pg/available or similar, or we can use admin endpoints.
    // Let's try to list PGs.
    const pgRes = await axios.get(`${API_URL}/pg`, { headers }); // Admin endpoint to list PGs
    const pgs = pgRes.data.data;
    
    if (!pgs || pgs.length === 0) {
      throw new Error('No Payment Gateways found.');
    }

    const selectedPg = pgs[0];
    console.log(`✅ Selected PG: ${selectedPg.name} (${selectedPg.id})`);

    console.log('\n4. Initiating Payment...');
    const payParams = {
      amount: billData.amount,
      mobileNumber: fetchParams.mobileNumber,
      cardLast4: fetchParams.cardLast4 || '1234',
      billerName: billData.billerName,
      pgId: selectedPg.id,
    };

    const payRes = await axios.post(`${API_URL}/bbps/pay`, payParams, { headers });
    console.log('✅ Payment Initiated Successfully:');
    console.log(JSON.stringify(payRes.data, null, 2));

  } catch (error: any) {
    console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
  }
}

testBBPS();
