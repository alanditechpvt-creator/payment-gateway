# Cashfree Payment Gateway Integration Guide

This guide provides step-by-step instructions for integrating Cashfree Payment Gateway into your system.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Get API Credentials](#get-api-credentials)
3. [Environment Setup](#environment-setup)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Webhook Setup](#webhook-setup)
7. [Testing](#testing)
8. [Production Checklist](#production-checklist)

---

## 1. Prerequisites

- Node.js 16+ installed
- A Cashfree merchant account
- HTTPS endpoint for webhooks (use ngrok for local testing)

---

## 2. Get API Credentials

### Step 1: Create Cashfree Account
1. Go to https://merchant.cashfree.com/merchants/signup
2. Complete the registration process
3. Verify your email and phone

### Step 2: Get Test Credentials (Sandbox)
1. Login to Cashfree Merchant Dashboard
2. Go to **Developers** → **API Keys**
3. Switch to **Test Mode** (toggle at top)
4. Copy:
   - **App ID** (starts with `TEST`)
   - **Secret Key**

### Step 3: Get Production Credentials
1. Complete KYC verification
2. Switch to **Production Mode**
3. Copy:
   - **App ID** (starts with your merchant code)
   - **Secret Key**

---

## 3. Environment Setup

Add these variables to your `.env` file:

```env
# ================================================================================
# CASHFREE PAYMENT GATEWAY
# ================================================================================

# Environment: false = Sandbox (Test), true = Production
CASHFREE_PRODUCTION=false

# API Credentials (from Cashfree Dashboard → Developers → API Keys)
CASHFREE_APP_ID=TEST101809669903adceae339230a7d566908101
CASHFREE_SECRET_KEY=cfsk_ma_test_xxxxxxxxxxxxxxxxxxxx

# URLs (Must be whitelisted in Cashfree Dashboard)
CASHFREE_RETURN_URL=http://localhost:5000/dashboard/transactions
CASHFREE_NOTIFY_URL=https://your-ngrok-url.ngrok.io/api/transactions/cashfree/webhook

# Your application URLs
FRONTEND_URL=http://localhost:5000
BACKEND_URL=http://localhost:4100
```

---

## 4. Backend Implementation

### Step 1: Install Dependencies

```bash
npm install crypto
```

### Step 2: Create Cashfree Service

```typescript
// services/cashfree.service.ts

import crypto from 'crypto';

interface CashfreeConfig {
  appId: string;
  secretKey: string;
  apiVersion: string;
  environment: 'sandbox' | 'production';
}

interface CreateOrderParams {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl?: string;
  notifyUrl?: string;
}

class CashfreeService {
  private config: CashfreeConfig | null = null;
  private baseUrl: string = '';

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv() {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const isProduction = process.env.CASHFREE_PRODUCTION === 'true';

    if (appId && secretKey) {
      this.config = {
        appId,
        secretKey,
        apiVersion: '2023-08-01',
        environment: isProduction ? 'production' : 'sandbox',
      };

      this.baseUrl = isProduction 
        ? 'https://api.cashfree.com/pg' 
        : 'https://sandbox.cashfree.com/pg';

      console.log(`Cashfree initialized (${this.config.environment} mode)`);
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getAppId(): string | null {
    return this.config?.appId || null;
  }

  getEnvironment(): string {
    return this.config?.environment || 'sandbox';
  }

  /**
   * Create a Cashfree Order
   * API: POST /orders
   * Docs: https://docs.cashfree.com/reference/pgcreateorder
   */
  async createOrder(params: CreateOrderParams): Promise<{
    success: boolean;
    orderId: string;
    cfOrderId?: string;
    paymentSessionId?: string;
    error?: string;
  }> {
    if (!this.config) {
      throw new Error('Cashfree is not configured');
    }

    try {
      const orderPayload = {
        order_id: params.orderId,
        order_amount: params.amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: params.customerPhone || params.customerEmail,
          customer_name: params.customerName || 'Customer',
          customer_email: params.customerEmail || 'customer@example.com',
          customer_phone: params.customerPhone || '9999999999',
        },
        order_meta: {
          return_url: params.returnUrl || `${process.env.FRONTEND_URL}/payment-status?order_id={order_id}`,
          notify_url: params.notifyUrl || `${process.env.BACKEND_URL}/api/cashfree/webhook`,
          payment_methods: null, // null = all methods enabled
        },
      };

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': this.config.apiVersion,
          'x-client-id': this.config.appId,
          'x-client-secret': this.config.secretKey,
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Cashfree create order error:', data);
        return {
          success: false,
          orderId: params.orderId,
          error: data.message || 'Failed to create order',
        };
      }

      console.log(`Cashfree order created: ${data.cf_order_id}`);

      return {
        success: true,
        orderId: params.orderId,
        cfOrderId: data.cf_order_id,
        paymentSessionId: data.payment_session_id,
      };
    } catch (error: any) {
      console.error('Cashfree create order error:', error);
      return {
        success: false,
        orderId: params.orderId,
        error: error.message || 'Failed to create order',
      };
    }
  }

  /**
   * Get Order Status
   * API: GET /orders/{order_id}
   * Docs: https://docs.cashfree.com/reference/pgfetchorder
   */
  async getOrderStatus(orderId: string): Promise<{
    orderId: string;
    orderStatus: string;
    orderAmount: number;
    cfOrderId: string;
    payments?: any[];
  } | null> {
    if (!this.config) {
      throw new Error('Cashfree is not configured');
    }

    try {
      // Get order details
      const orderResponse = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'x-api-version': this.config.apiVersion,
          'x-client-id': this.config.appId,
          'x-client-secret': this.config.secretKey,
        },
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        console.error('Cashfree get order error:', orderData);
        return null;
      }

      // Get payments for this order
      const paymentsResponse = await fetch(`${this.baseUrl}/orders/${orderId}/payments`, {
        method: 'GET',
        headers: {
          'x-api-version': this.config.apiVersion,
          'x-client-id': this.config.appId,
          'x-client-secret': this.config.secretKey,
        },
      });

      let payments: any[] = [];
      if (paymentsResponse.ok) {
        payments = await paymentsResponse.json();
      }

      return {
        orderId: orderData.order_id,
        orderStatus: orderData.order_status,
        orderAmount: orderData.order_amount,
        cfOrderId: orderData.cf_order_id,
        payments: Array.isArray(payments) ? payments : [],
      };
    } catch (error: any) {
      console.error('Cashfree get order status error:', error);
      return null;
    }
  }

  /**
   * Verify Webhook Signature
   * Cashfree uses: HMAC-SHA256(timestamp + rawBody, secretKey) as base64
   * Docs: https://docs.cashfree.com/reference/pg-webhook
   */
  verifyWebhookSignature(timestamp: string, rawBody: string, signature: string): boolean {
    if (!this.config) {
      return false;
    }

    try {
      const signedPayload = timestamp + rawBody;
      const expectedSignature = crypto
        .createHmac('sha256', this.config.secretKey)
        .update(signedPayload)
        .digest('base64');

      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Map Cashfree Order Status to Application Status
   */
  mapOrderStatus(orderStatus: string): 'PENDING' | 'SUCCESS' | 'FAILED' {
    const statusMap: { [key: string]: 'PENDING' | 'SUCCESS' | 'FAILED' } = {
      'ACTIVE': 'PENDING',
      'PAID': 'SUCCESS',
      'EXPIRED': 'FAILED',
      'TERMINATED': 'FAILED',
      'PARTIALLY_PAID': 'PENDING',
    };

    return statusMap[orderStatus?.toUpperCase()] || 'PENDING';
  }
}

export const cashfreeService = new CashfreeService();
```

### Step 3: Create API Routes

```typescript
// routes/cashfree.routes.ts

import { Router } from 'express';
import { cashfreeService } from '../services/cashfree.service';

const router = Router();

/**
 * Create Order
 * POST /api/cashfree/create-order
 */
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ success: false, error: 'orderId and amount are required' });
    }

    const result = await cashfreeService.createOrder({
      orderId,
      amount: Number(amount),
      customerName,
      customerEmail,
      customerPhone,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: {
        orderId: result.orderId,
        cfOrderId: result.cfOrderId,
        paymentSessionId: result.paymentSessionId,
        environment: cashfreeService.getEnvironment(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify Payment (called after redirect)
 * POST /api/cashfree/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' });
    }

    const orderStatus = await cashfreeService.getOrderStatus(orderId);

    if (!orderStatus) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const status = cashfreeService.mapOrderStatus(orderStatus.orderStatus);

    res.json({
      success: true,
      data: {
        orderId: orderStatus.orderId,
        cfOrderId: orderStatus.cfOrderId,
        status,
        amount: orderStatus.orderAmount,
        payments: orderStatus.payments,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Webhook Handler
 * POST /api/cashfree/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    // Verify signature
    if (!cashfreeService.verifyWebhookSignature(timestamp, rawBody, signature)) {
      console.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;
    const eventType = payload.type;
    const order = payload.data?.order || {};
    const payment = payload.data?.payment || {};

    console.log('Cashfree webhook received:', {
      type: eventType,
      orderId: order.order_id,
      orderStatus: order.order_status,
    });

    // Handle different event types
    switch (eventType) {
      case 'PAYMENT_SUCCESS_WEBHOOK':
        // Payment successful - update your database
        console.log(`Payment SUCCESS for order: ${order.order_id}`);
        // TODO: Update transaction status to SUCCESS
        // TODO: Credit user wallet
        break;

      case 'PAYMENT_FAILED_WEBHOOK':
        // Payment failed
        console.log(`Payment FAILED for order: ${order.order_id}`);
        // TODO: Update transaction status to FAILED
        break;

      case 'PAYMENT_USER_DROPPED_WEBHOOK':
        // User dropped off
        console.log(`User dropped for order: ${order.order_id}`);
        // TODO: Mark as abandoned or pending
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    // Always respond 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Check Order Status (manual check)
 * GET /api/cashfree/status/:orderId
 */
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderStatus = await cashfreeService.getOrderStatus(orderId);

    if (!orderStatus) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({
      success: true,
      data: orderStatus,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

---

## 5. Frontend Implementation

### Step 1: Load Cashfree SDK

```html
<!-- Add to your HTML -->
<script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
```

### Step 2: React Component

```tsx
// components/CashfreePayment.tsx

import { useState } from 'react';

interface PaymentData {
  paymentSessionId: string;
  orderId: string;
  environment: 'sandbox' | 'production';
}

declare global {
  interface Window {
    Cashfree: any;
  }
}

export function CashfreePayment() {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('100');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const initiatePayment = async () => {
    setLoading(true);

    try {
      // Step 1: Create order on backend
      const response = await fetch('/api/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `ORDER_${Date.now()}`,
          amount: parseFloat(amount),
          customerName,
          customerEmail,
          customerPhone,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create order');
      }

      // Step 2: Initialize Cashfree SDK
      const cashfree = window.Cashfree({
        mode: data.data.environment === 'production' ? 'production' : 'sandbox',
      });

      // Step 3: Open checkout
      const result = await cashfree.checkout({
        paymentSessionId: data.data.paymentSessionId,
        redirectTarget: '_modal', // or '_self' for full page redirect
      });

      if (result.error) {
        console.error('Payment error:', result.error);
        alert(`Payment failed: ${result.error.message}`);
      } else if (result.paymentDetails) {
        // Step 4: Verify payment on backend
        const verifyResponse = await fetch('/api/cashfree/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: data.data.orderId }),
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.success && verifyData.data.status === 'SUCCESS') {
          alert('Payment successful!');
        } else {
          alert('Payment verification failed');
        }
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-form">
      <h2>Pay with Cashfree</h2>
      
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      
      <input
        type="text"
        placeholder="Name"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
      />
      
      <input
        type="email"
        placeholder="Email"
        value={customerEmail}
        onChange={(e) => setCustomerEmail(e.target.value)}
      />
      
      <input
        type="tel"
        placeholder="Phone"
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
      />
      
      <button onClick={initiatePayment} disabled={loading}>
        {loading ? 'Processing...' : `Pay ₹${amount}`}
      </button>
    </div>
  );
}
```

---

## 6. Webhook Setup

### Configure Webhooks in Cashfree Dashboard

1. Login to **Cashfree Merchant Dashboard**
2. Go to **Developers** → **Webhooks**
3. Add Webhook Endpoint:
   - **URL**: `https://yourdomain.com/api/cashfree/webhook`
   - **Events**: Select all payment events
   - **Version**: 2023-08-01

### Webhook Events

| Event | Description |
|-------|-------------|
| `PAYMENT_SUCCESS_WEBHOOK` | Payment completed successfully |
| `PAYMENT_FAILED_WEBHOOK` | Payment failed |
| `PAYMENT_USER_DROPPED_WEBHOOK` | User abandoned payment |
| `REFUND_STATUS_WEBHOOK` | Refund status update |

### Webhook Payload Example

```json
{
  "type": "PAYMENT_SUCCESS_WEBHOOK",
  "data": {
    "order": {
      "order_id": "ORDER_123456",
      "order_amount": 100.00,
      "order_currency": "INR",
      "order_status": "PAID",
      "cf_order_id": "2203487400"
    },
    "payment": {
      "cf_payment_id": "1234567890",
      "payment_status": "SUCCESS",
      "payment_amount": 100.00,
      "payment_method": "upi",
      "payment_time": "2024-01-20T15:30:00+05:30"
    }
  }
}
```

### Signature Verification

```typescript
// Cashfree webhook signature verification
const verifySignature = (timestamp: string, rawBody: string, signature: string): boolean => {
  const signedPayload = timestamp + rawBody;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.CASHFREE_SECRET_KEY!)
    .update(signedPayload)
    .digest('base64');
  
  return expectedSignature === signature;
};
```

---

## 7. Testing

### Test Cards (Sandbox)

| Card Number | Type | Result |
|-------------|------|--------|
| 4111111111111111 | Visa | Success |
| 5454545454545454 | Mastercard | Success |
| 4111111111111120 | Visa | Failure |

### Test UPI (Sandbox)

- UPI ID: `success@upi` → Success
- UPI ID: `failure@upi` → Failure

### Test Flow

1. Create order with sandbox credentials
2. Use test card/UPI
3. Complete payment on Cashfree page
4. Verify webhook is received
5. Check order status via API

### Using ngrok for Local Webhook Testing

```bash
# Install ngrok
npm install -g ngrok

# Start ngrok tunnel
ngrok http 4100

# Use the generated URL for webhooks
# Example: https://abc123.ngrok.io/api/cashfree/webhook
```

---

## 8. Production Checklist

### Before Going Live

- [ ] Complete KYC verification on Cashfree
- [ ] Get production API credentials
- [ ] Update `.env` with production values:
  ```env
  CASHFREE_PRODUCTION=true
  CASHFREE_APP_ID=<production_app_id>
  CASHFREE_SECRET_KEY=<production_secret_key>
  ```
- [ ] Set up production webhook URL
- [ ] Whitelist production return URL
- [ ] Test with production credentials (small amount)
- [ ] Implement proper error handling
- [ ] Set up logging and monitoring
- [ ] Configure rate limiting

### Security Best Practices

1. **Never expose secret key** in frontend code
2. **Always verify webhook signatures** before processing
3. **Use HTTPS** for all API calls
4. **Validate amounts** on backend before processing
5. **Implement idempotency** for webhook handling
6. **Log all transactions** for audit trail

---

## API Reference

### Order Status Values

| Status | Description |
|--------|-------------|
| `ACTIVE` | Order created, payment pending |
| `PAID` | Payment successful |
| `EXPIRED` | Order expired (no payment) |
| `TERMINATED` | Order cancelled |
| `PARTIALLY_PAID` | Partial payment received |

### Payment Status Values

| Status | Description |
|--------|-------------|
| `SUCCESS` | Payment successful |
| `FAILED` | Payment failed |
| `PENDING` | Payment in progress |
| `NOT_ATTEMPTED` | No payment attempt |
| `USER_DROPPED` | User abandoned |

---

## Support & Resources

- **Cashfree Documentation**: https://docs.cashfree.com/
- **API Reference**: https://docs.cashfree.com/reference/
- **Test Environment**: https://sandbox.cashfree.com/
- **Merchant Dashboard**: https://merchant.cashfree.com/
- **Support**: support@cashfree.com

---

*Last Updated: January 2026*

