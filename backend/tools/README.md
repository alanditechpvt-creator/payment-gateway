This folder contains a small helper to sign and send a Cashfree webhook to your local backend (exposed via ngrok).

Files
- `sign-and-send.js`: Node script that computes `x-webhook-timestamp` and `x-webhook-signature` (HMAC-SHA256 of timestamp+rawPayload using merchant secret) and POSTs the payload to the target URL.

Usage
1. Install `minimist` (and `node-fetch` if you're on Node <18):

```powershell
cd backend\tools
npm install minimist
# (optional) npm install node-fetch
```

2. Run the script (replace secret and url):

```powershell
# Example (PowerShell)
$env:CF_SECRET = 'cfsk_ma_test_...'
node sign-and-send.js --url "https://centerable-harlan-slinkingly.ngrok-free.dev/api/webhooks/cashfree" --orderId "TXN_TEST_123" --amount "10.00"
```

Or pass secret and url as flags:

```powershell
node sign-and-send.js --secret "cfsk_ma_test..." --url "https://centerable-harlan-slinkingly.ngrok-free.dev/api/webhooks/cashfree"
```

3. Observe backend logs and response. The script prints the timestamp, signature, request body and the response from your server.

Notes
- Ensure your backend is running and the `CASHFREE_CALLBACK_URL` in `backend/.env` matches the ngrok URL (including `/api/webhooks/cashfree`).
- Keep signature verification enabled. Only bypass verification for short local debugging and re-enable before production.
