# Razorpay E2E Integration Testing Guide

## Quick Start

### Step 1: Configure Credentials

Edit `backend/.env` and add your test credentials:

```env
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxx
RAZORPAY_CALLBACK_URL=http://localhost:4100/api/razorpay/webhook
```

### Step 2: Restart Servers

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Step 3: Test Payment Flow

#### Option A: Using Frontend UI

1. Open http://localhost:5000
2. Create a transaction
3. Click "Pay with Razorpay" button
4. Use test card: `4111 1111 1111 1111`
5. Complete payment

#### Option B: Using API Directly

##### 1. Create Transaction
```bash
curl -X POST http://localhost:4100/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PAYIN",
    "amount": 100,
    "description": "Test payment"
  }'
```

Response includes `id` (transaction ID).

##### 2. Create Razorpay Order
```bash
curl -X POST http://localhost:4100/api/razorpay/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn_xxxxx",
    "amount": 100.00,
    "description": "Test payment"
  }'
```

Response includes `razorpayOrderId` and `keyId`.

##### 3. Verify Payment (after paying in Razorpay checkout)
```bash
curl -X POST http://localhost:4100/api/razorpay/verify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn_xxxxx",
    "razorpayPaymentId": "pay_xxxxx",
    "razorpayOrderId": "order_xxxxx",
    "razorpaySignature": "signature_hash"
  }'
```

Response confirms payment success.

## Test Scenarios

### Scenario 1: Successful Payment

**Test Card:** `4111 1111 1111 1111`
**Amount:** ₹100
**Expected Result:** Payment captured, transaction marked SUCCESS

**Steps:**
1. Create transaction for ₹100
2. Click pay button
3. Enter card: 4111 1111 1111 1111
4. Enter any future expiry and CVV
5. Complete payment
6. Should see success message
7. Transaction status should be "SUCCESS"

### Scenario 2: Failed Payment

**Test Card:** `4222 2222 2222 2222`
**Amount:** ₹50
**Expected Result:** Payment declined, transaction marked FAILED

**Steps:**
1. Create transaction for ₹50
2. Click pay button
3. Enter card: 4222 2222 2222 2222
4. Try to complete payment
5. Payment should fail
6. Should see error message
7. Transaction status should be "FAILED"

### Scenario 3: Payment Cancellation

**Expected Result:** Payment cancelled, no charge

**Steps:**
1. Create transaction
2. Click pay button
3. Razorpay modal opens
4. Click close/cancel
5. Should see cancellation message
6. Transaction status should be "PENDING"

### Scenario 4: Check Payment Status

**Expected Result:** Can fetch payment status any time

```bash
curl -X GET http://localhost:4100/api/razorpay/status/txn_xxxxx \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response shows:
- Current transaction status
- Payment ID
- Amount
- Payment method (card, upi, etc)

### Scenario 5: Refund Payment

**Expected Result:** Full or partial refund processed

```bash
curl -X POST http://localhost:4100/api/razorpay/refund \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "txn_xxxxx",
    "amount": 50.00
  }'
```

Response includes refund ID and status.

## Webhook Testing

### Manual Webhook Test

You can manually trigger webhook events using Razorpay Dashboard or curl:

```bash
curl -X POST http://localhost:4100/api/razorpay/webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: test_signature" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test",
          "status": "captured",
          "amount": 10000,
          "order_id": "order_test",
          "method": "card",
          "card": {
            "network": "Visa",
            "last4": "1111"
          },
          "notes": {
            "transactionId": "txn_test"
          }
        }
      }
    }
  }'
```

### Set Up Webhook in Dashboard

1. Go to Razorpay Dashboard
2. Settings > Webhooks
3. Add Webhook URL: `http://localhost:4100/api/razorpay/webhook`
4. Select events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
5. Save and copy webhook secret
6. Update `RAZORPAY_WEBHOOK_SECRET` in `.env`

## Debugging

### Check Backend Logs

```bash
tail -f backend/backend-log.txt
```

Look for:
- `Razorpay service initialized`
- `Razorpay order created: order_xxxxx`
- `Payment verified successfully`
- `Transaction xxxxx updated with payment`

### Check API Response

Always verify API responses for:
- `"success": true` - Operation succeeded
- `"success": false` with `"error"` message - Check error

### Common Issues

#### Issue: "Razorpay not enabled or configured"
- Verify `RAZORPAY_ENABLED=true` in `.env`
- Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set
- Restart backend server

#### Issue: "Signature verification failed"
- Check `RAZORPAY_WEBHOOK_SECRET` is correct
- Verify webhook request is sending raw body
- Check X-Razorpay-Signature header

#### Issue: "Transaction not found"
- Verify transaction ID is correct
- Ensure transaction exists in database
- Check transaction belongs to authenticated user

#### Issue: Razorpay checkout doesn't open
- Check browser console for JavaScript errors
- Verify Razorpay script loaded: `window.Razorpay` exists
- Check network tab - order creation request should succeed

## Validation Checklist

Use this checklist to verify full integration:

- [ ] Backend server starts with Razorpay service initialized
- [ ] Frontend server starts without errors
- [ ] Create transaction endpoint works
- [ ] Razorpay order creation endpoint works
- [ ] Razorpay checkout modal opens with payment button
- [ ] Test card payment succeeds
- [ ] Payment verification endpoint works
- [ ] Transaction status updates to SUCCESS
- [ ] Failed payment test card declines
- [ ] Payment status can be checked at any time
- [ ] Refund endpoint processes refunds
- [ ] Webhook signature verification works
- [ ] Webhook events update transactions
- [ ] Error messages display correctly
- [ ] Payment state persists in database

## Performance Testing

### Load Testing Payment Endpoint

```bash
# Using Apache Bench
ab -n 100 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:4100/api/razorpay/orders

# Using wrk
wrk -t4 -c100 -d30s -s script.lua http://localhost:4100/api/razorpay/orders
```

### Memory Usage
Monitor backend process:
```bash
# On Windows PowerShell
Get-Process node | Format-Table ProcessName, WorkingSet -AutoSize

# On Linux/Mac
ps aux | grep node
```

## Next Steps

Once testing is complete:

1. ✅ Review logs for any errors
2. ✅ Test with multiple card types
3. ✅ Test refund scenarios
4. ✅ Test webhook handling
5. ✅ Set up monitoring/alerts
6. ✅ Prepare for production deployment

See `RAZORPAY_INTEGRATION_GUIDE.md` for production setup.

---

**Status:** Ready for Testing ✅
