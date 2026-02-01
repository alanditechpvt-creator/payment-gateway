import axios from 'axios';

const BASE_URL = 'http://localhost:4100/api';

async function testBBPS() {
  try {
    console.log('🔐 Step 1: Logging in...');
    
    // Login to get auth token - UPDATE THESE CREDENTIALS
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@newweb.com', // Admin email from .env
      password: 'Admin@123456', // Admin password from .env
    });

    const token = loginResponse.data.data?.accessToken || loginResponse.data.token;
    console.log('✅ Login successful! Token:', token.substring(0, 20) + '...');

    console.log('\n💳 Step 2: Fetching credit card bill...');
    
    // Fetch bill
    const billResponse = await axios.post(
      `${BASE_URL}/bbps/fetch`,
      {
        category: 'CREDIT_CARD',
        mobileNumber: '9876543210', // Update with actual mobile number
        cardLast4: '1234', // Optional
        billerId: '', // Optional
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('\n✅ Bill Fetch Response:');
    console.log(JSON.stringify(billResponse.data, null, 2));

    if (billResponse.data.success) {
      const bill = billResponse.data.data;
      console.log('\n📄 Bill Details:');
      console.log(`   Biller: ${bill.billerName}`);
      console.log(`   Amount: ₹${bill.amount}`);
      console.log(`   Due Date: ${bill.dueDate}`);
      console.log(`   Bill Number: ${bill.billNumber}`);
      console.log(`   Status: ${bill.status}`);
      console.log(`   Cached: ${billResponse.data.cached ? 'Yes' : 'No'}`);

      // Test refresh if bill ID exists
      if (bill.id) {
        console.log('\n🔄 Step 3: Testing bill refresh...');
        
        const refreshResponse = await axios.post(
          `${BASE_URL}/bbps/refresh/${bill.id}`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        console.log('\n✅ Refresh Response:');
        console.log(JSON.stringify(refreshResponse.data, null, 2));
      }
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      
      // Show full error stack if available
      if (error.response.data.stack) {
        console.error('\nStack Trace:');
        console.error(error.response.data.stack);
      }
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Request:', error.request);
    } else {
      console.error('Error details:', error);
    }
    process.exit(1);
  }
}

console.log('🚀 Starting BBPS Bill Fetch Test...\n');
testBBPS();
