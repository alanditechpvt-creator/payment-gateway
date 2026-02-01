# 🚀 Razorpay Quick Start (5 minutes)

## Step 1: Configure Credentials (2 min)

1. Open `backend/.env`
2. Add these lines with your test credentials:

```env
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
```

Get credentials from: https://dashboard.razorpay.com/app/settings/api-keys

## Step 2: Start Servers (1 min)

**Terminal 1:**
```bash
cd backend && npm run dev
```

**Terminal 2:**
```bash
cd frontend && npm run dev
```

## Step 3: Test Payment (2 min)

1. Open http://localhost:5000
2. Create a transaction
3. Click "Pay with Razorpay"
4. Use test card: **4111 1111 1111 1111**
5. Enter any future date and CVV
6. Complete payment
7. ✅ Done!

---

## Test Cards

| Type | Card Number | Result |
|------|-------------|--------|
| Success | 4111 1111 1111 1111 | Payment succeeds |
| Failure | 4222 2222 2222 2222 | Payment fails |

---

## API Quick Reference

### Create Payment Order
```bash
curl -X POST http://localhost:4100/api/razorpay/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"txn_123","amount":100}'
```

### Check Payment Status
```bash
curl -X GET http://localhost:4100/api/razorpay/status/txn_123 \
  -H "Authorization: Bearer TOKEN"
```

### Refund Payment
```bash
curl -X POST http://localhost:4100/api/razorpay/refund \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transactionId":"txn_123","amount":50}'
```

---

## What's Ready ✅

- ✅ Razorpay SDK installed
- ✅ Payment service created
- ✅ API endpoints configured
- ✅ Frontend component ready
- ✅ Webhook handler ready
- ✅ Signature verification enabled
- ✅ Error handling included
- ✅ Logging configured

---

## Next: Full Setup?

See `RAZORPAY_INTEGRATION_GUIDE.md` for:
- Complete configuration
- Webhook setup
- Production deployment
- Security best practices
- Troubleshooting

---

## Need Help?

1. Check `RAZORPAY_TESTING_GUIDE.md` for test scenarios
2. Review `RAZORPAY_INTEGRATION_GUIDE.md` for detailed guide
3. Check backend logs: `tail -f backend/backend-log.txt`
4. Verify credentials in `backend/.env`

---

**Ready to go live?** 🎉 You have everything you need!
