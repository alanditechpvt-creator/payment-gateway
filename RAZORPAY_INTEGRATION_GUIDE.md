# Razorpay Integration Guide

## Overview

This guide walks you through the complete Razorpay integration setup for the WebsiteNew platform.

## Prerequisites

- Razorpay test account credentials (Key ID and Key Secret)
- Backend running on http://localhost:4100
- Frontend running on http://localhost:5000

## Step 1: Configure Environment Variables

### Backend (.env file)

Add the following environment variables to `backend/.env`:

```env
# Razorpay Configuration (Test Mode)
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID=your_test_key_id_here
RAZORPAY_KEY_SECRET=your_test_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
RAZORPAY_CALLBACK_URL=http://localhost:4100/api/razorpay/webhook
```

**Note:** Replace the placeholder values with your actual Razorpay test credentials.

### Frontend (.env.local file)

Add the following to `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4100/api
```

## Step 2: Backend Setup

### 2.1 Install Dependencies

The Razorpay SDK has already been installed:

```bash
npm list razorpay
```

### 2.2 Verify Configuration

The following files have been created:

1. **Razorpay Service** (`backend/src/services/razorpay.service.ts`)
   - Handles all Razorpay API interactions
   - Order creation
   - Payment verification
   - Webhook handling
   - Refunds

2. **Razorpay Controller** (`backend/src/controllers/razorpay.controller.ts`)
   - API endpoint handlers
   - Order creation endpoint
   - Payment verification endpoint
   - Webhook endpoint
   - Refund endpoint

3. **Razorpay Routes** (`backend/src/routes/razorpay.routes.ts`)
   - REST API endpoints
   - Authentication middleware
   - Webhook endpoint (unauthenticated but signature verified)

### 2.3 Start Backend Server

```bash
cd backend
npm run dev
```

Backend will run on http://localhost:4100/api

## Step 3: Frontend Setup

### 3.1 Create Payment Component

The Razorpay checkout component has been created at:
`frontend/src/components/RazorpayCheckout.tsx`

### 3.2 Usage in Your Components

Import and use the component:

```typescript
import { RazorpayCheckout } from '@/components/RazorpayCheckout';

export function TransactionPayment() {
  const handlePaymentSuccess = (paymentId: string, orderId: string) => {
    console.log('Payment successful:', { paymentId, orderId });
    // Update transaction status
  };

  return (
    <RazorpayCheckout
      transactionId="txn_12345"
      amount={100.00}
      customerName="John Doe"
      customerEmail="john@example.com"
      customerPhone="9876543210"
      onSuccess={handlePaymentSuccess}
      onError={(error) => console.error('Payment error:', error)}
      description="Payment for transaction"
    />
  );
}
```

### 3.3 Start Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on http://localhost:5000

## Step 4: API Endpoints

### Create Order
**POST** `/api/razorpay/orders`

```json
{
  "transactionId": "txn_123",
  "amount": 100.00,
  "description": "Payment description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123",
    "razorpayOrderId": "order_2Udit...",
    "amount": 10000,
    "currency": "INR",
    "keyId": "rzp_test_..."
  }
}
```

### Verify Payment
**POST** `/api/razorpay/verify`

```json
{
  "transactionId": "txn_123",
  "razorpayPaymentId": "pay_2Udmt...",
  "razorpayOrderId": "order_2Udit...",
  "razorpaySignature": "signature_hash"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123",
    "paymentId": "pay_2Udmt...",
    "status": "captured",
    "amount": 10000
  }
}
```

### Get Payment Status
**GET** `/api/razorpay/status/:transactionId`

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123",
    "status": "captured",
    "amount": 10000,
    "paymentId": "pay_2Udmt...",
    "method": "card"
  }
}
```

### Refund Payment
**POST** `/api/razorpay/refund`

```json
{
  "transactionId": "txn_123",
  "amount": 50.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "txn_123",
    "refundId": "rfnd_2Uds0...",
    "amount": 5000,
    "status": "processed"
  }
}
```

### Webhook Endpoint
**POST** `/api/razorpay/webhook`

Razorpay will send webhook events to this endpoint. Events handled:
- `payment.authorized` - Payment authorized
- `payment.captured` - Payment captured
- `payment.failed` - Payment failed
- `refund.created` - Refund processed

## Step 5: Testing with Razorpay

### Test Credentials

Use these test card details with Razorpay:

**Successful Payment:**
- Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVV: Any 3 digits

**Failed Payment:**
- Card: 4222 2222 2222 2222
- Expiry: Any future date
- CVV: Any 3 digits

### Test Flow

1. **Create a Transaction**
   - Use the frontend to create a new transaction

2. **Initiate Payment**
   - Click the "Pay" button
   - Razorpay checkout modal will open

3. **Enter Test Card Details**
   - Use the test card numbers above
   - Complete the payment flow

4. **Verify Payment**
   - Backend automatically verifies the signature
   - Transaction status is updated
   - Frontend receives success callback

5. **Check Status**
   - Use the Get Payment Status endpoint to check at any time

## Step 6: Production Setup

For production deployment:

### 1. Update Razorpay Credentials
```env
RAZORPAY_KEY_ID=your_prod_key_id
RAZORPAY_KEY_SECRET=your_prod_key_secret
RAZORPAY_WEBHOOK_SECRET=your_prod_webhook_secret
```

### 2. Update URLs
```env
RAZORPAY_CALLBACK_URL=https://yourdomain.com/api/razorpay/webhook
```

### 3. Configure Webhook in Razorpay Dashboard

1. Go to Razorpay Dashboard > Settings > Webhooks
2. Add webhook URL: `https://yourdomain.com/api/razorpay/webhook`
3. Select events to subscribe:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
4. Save webhook secret from the dashboard

### 4. Enable HTTPS
- Ensure all URLs use HTTPS in production
- Update CORS settings accordingly

## Troubleshooting

### Issue: "Razorpay not enabled or configured"
**Solution:** Check that `RAZORPAY_ENABLED=true` and credentials are set in `.env`

### Issue: "Signature verification failed"
**Solution:** 
- Verify `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard
- Ensure webhook is receiving raw body

### Issue: Payment modal doesn't open
**Solution:**
- Check browser console for errors
- Verify Razorpay script loaded: `window.Razorpay` should exist
- Check network tab for order creation response

### Issue: "Transaction not found"
**Solution:**
- Ensure transaction exists before creating payment
- Verify transactionId matches exactly

## File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── razorpay.service.ts          # Razorpay API integration
│   ├── controllers/
│   │   └── razorpay.controller.ts       # API handlers
│   ├── routes/
│   │   ├── razorpay.routes.ts           # Razorpay endpoints
│   │   └── index.ts                     # Route mounting
│   └── config/
│       └── index.ts                     # Configuration

frontend/
├── src/
│   └── components/
│       └── RazorpayCheckout.tsx         # Payment component
└── .env.local                            # Frontend config
```

## Security Best Practices

1. **Never commit credentials** - Use environment variables
2. **Verify signatures** - All webhook requests are signature-verified
3. **HTTPS only** - Use HTTPS in production
4. **Secret management** - Store secrets in secure vaults
5. **Rate limiting** - Implement rate limits on payment endpoints
6. **Audit logs** - Log all payment transactions

## Next Steps

1. ✅ Setup environment variables
2. ✅ Start backend server
3. ✅ Start frontend server
4. ✅ Test payment flow with test credentials
5. ✅ Monitor transaction status
6. ✅ Configure webhooks in Razorpay dashboard (production only)
7. ✅ Deploy to production

## Support

For issues:
- Check Razorpay docs: https://razorpay.com/docs/
- Review integration logs in `backend-log.txt`
- Check browser console for frontend errors

---

**Integration Status:** ✅ Complete and Ready for Testing
