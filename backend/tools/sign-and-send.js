#!/usr/bin/env node
const crypto = require('crypto');

async function main() {
  const argv = require('minimist')(process.argv.slice(2));

  const secret = argv.secret || process.env.CF_SECRET;
  const url = argv.url || process.env.TARGET_URL;
  const orderId = argv.orderId || `TXN_TEST_${Date.now()}`;
  const amount = argv.amount || '10.00';
  const referenceId = argv.referenceId || `CF_REF_${Date.now()}`;
  const rawBody = argv.body ? JSON.parse(argv.body) : {
    order_id: orderId,
    orderAmount: amount,
    orderStatus: 'SUCCESS',
    txStatus: 'SUCCESS',
    referenceId: referenceId,
  };

  if (!secret) {
    console.error('Missing Cashfree secret. Provide --secret or set CF_SECRET env var.');
    process.exit(1);
  }
  if (!url) {
    console.error('Missing target URL. Provide --url or set TARGET_URL env var.');
    process.exit(1);
  }

  const raw = JSON.stringify(rawBody);
  const ts = Date.now().toString();
  const payload = ts + raw;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64');

  console.log('Posting webhook to', url);
  console.log('x-webhook-timestamp:', ts);
  console.log('x-webhook-signature:', sig);
  console.log('body:', raw);

  // Use fetch if available (Node 18+), otherwise fallback to node-fetch
  let fetchFn;
  try {
    fetchFn = global.fetch || require('node-fetch');
  } catch (e) {
    console.error('Fetch not available. Please run on Node 18+ or install node-fetch.');
    process.exit(1);
  }

  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-timestamp': ts,
      'x-webhook-signature': sig,
    },
    body: raw,
  });

  const text = await res.text();
  console.log('Response status:', res.status);
  console.log('Response body:', text);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
