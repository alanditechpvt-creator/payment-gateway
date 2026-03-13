import axios from 'axios';

async function main() {
  // 1) Set your backend API base URL
  const API_URL = 'http://localhost:4100/api';

  // 2) Paste an admin JWT access token here (from admin login localStorage)
  const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlNjZhZjVhYy1jZjczLTRmMTMtYTA5Zi03NmU4MmVkNmM3YTciLCJlbWFpbCI6ImFkbWluQGFsYW5kaS5pbiIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3MjY5Mzg2MiwiZXhwIjoxNzcyNzgwMjYyfQ.KT9IHKs-iASsE4_8LVmyEnW4jNSDpRS0yozm84NAE5E';

  if (!ADMIN_TOKEN) {
    console.error('Please set ADMIN_TOKEN in check-global-ledger.ts');
    process.exit(1);
  }

  try {
    const res = await axios.get(`${API_URL}/ledger/global`, {
      params: {
        page: 1,
        limit: 50,
        // type: 'COMMISSION', // uncomment to see ONLY commission rows
      },
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    });

    console.log('Status:', res.status);
    console.log('Data:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    if (err.response) {
      console.error('Error status:', err.response.status);
      console.error('Error data:', err.response.data);
    } else {
      console.error('Request error:', err.message);
    }
  }
}

main();