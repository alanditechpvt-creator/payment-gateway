# Razorpay Payment Gateway Integration Guide

A complete step-by-step guide to integrate Razorpay into any Node.js/React application.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Get API Credentials](#2-get-api-credentials)
3. [Environment Setup](#3-environment-setup)
4. [Install Dependencies](#4-install-dependencies)
5. [Backend Implementation](#5-backend-implementation)
6. [Frontend Implementation](#6-frontend-implementation)
7. [Signature Validation](#7-signature-validation)
8. [Webhook Setup](#8-webhook-setup)
9. [Testing](#9-testing)
10. [Production Checklist](#10-production-checklist)

---

## 1. Prerequisites

- Node.js 16+ 
- Razorpay account (Test or Live)
- HTTPS enabled server (required for production)

---

## 2. Get API Credentials

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Navigate to **Settings → API Keys**
3. Generate a new API Key pair
4. Save both **Key ID** and **Key Secret** (Secret is shown only once!)

**Test Mode Keys:**
- Key ID format: `rzp_test_XXXXXXXXXXXX`
- Key Secret format: Random string ~24 characters

**Live Mode Keys:**
- Key ID format: `rzp_live_XXXXXXXXXXXX`
- Key Secret format: Random string ~24 characters

---

## 3. Environment Setup

Add to your `.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here  # Optional, for webhook verification

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:3000
```

---

## 4. Install Dependencies

### Backend (Node.js)
```bash
npm install razorpay
```

### Frontend (React)
No npm package needed - load Razorpay script dynamically.

---

## 5. Backend Implementation

### 5.1 Razorpay Service

Create `services/razorpay.service.js`:

```javascript
const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Create a Razorpay Order
   * @param {Object} params
   * @param {number} params.amount - Amount in RUPEES (will be converted to paise)
   * @param {string} params.receipt - Unique order ID from your system
   * @param {Object} params.notes - Optional metadata
   */
  async createOrder({ amount, receipt, notes = {} }) {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR',
        receipt: receipt,
        notes: notes,
      });

      return {
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      };
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      throw new Error(error.error?.description || 'Failed to create order');
    }
  }

  /**
   * Verify Payment Signature
   * CRITICAL: Always verify signature before crediting user
   */
  verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === razorpay_signature;
  }

  /**
   * Verify Webhook Signature
   */
  verifyWebhookSignature(body, signature) {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Fetch Payment Details
   */
  async getPaymentDetails(paymentId) {
    try {
      return await this.razorpay.payments.fetch(paymentId);
    } catch (error) {
      console.error('Fetch payment error:', error);
      return null;
    }
  }

  /**
   * Refund Payment
   */
  async refundPayment(paymentId, amount = null) {
    try {
      const refundData = amount ? { amount: Math.round(amount * 100) } : {};
      return await this.razorpay.payments.refund(paymentId, refundData);
    } catch (error) {
      console.error('Refund error:', error);
      throw error;
    }
  }
}

module.exports = new RazorpayService();
```

### 5.2 API Routes

Create `routes/payment.routes.js`:

```javascript
const express = require('express');
const router = express.Router();
const razorpayService = require('../services/razorpay.service');

/**
 * Step 1: Create Order
 * POST /api/payment/create-order
 */
router.post('/create-order', async (req, res) => {
  try {
    const { amount, orderId, customerName, customerEmail, customerPhone } = req.body;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create Razorpay order
    const result = await razorpayService.createOrder({
      amount: amount,
      receipt: orderId || `order_${Date.now()}`,
      notes: {
        customerName,
        customerEmail,
        customerPhone,
      },
    });

    // Save order to your database here
    // await db.orders.create({ orderId, razorpayOrderId: result.orderId, amount, status: 'PENDING' });

    res.json({
      success: true,
      orderId: result.orderId,
      amount: result.amount,
      currency: result.currency,
      keyId: result.keyId,
      prefill: {
        name: customerName,
        email: customerEmail,
        contact: customerPhone,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Step 2: Verify Payment (called after Razorpay checkout success)
 * POST /api/payment/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // CRITICAL: Verify signature
    const isValid = razorpayService.verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isValid) {
      console.error('Payment signature verification failed!');
      return res.status(400).json({ 
        success: false, 
        error: 'Payment verification failed - invalid signature' 
      });
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await razorpayService.getPaymentDetails(razorpay_payment_id);

    if (!paymentDetails) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not fetch payment details' 
      });
    }

    // Check payment status
    if (paymentDetails.status !== 'captured') {
      return res.status(400).json({ 
        success: false, 
        error: `Payment not captured. Status: ${paymentDetails.status}` 
      });
    }

    // Update your database - mark order as paid
    // await db.orders.update({ orderId }, { 
    //   status: 'PAID', 
    //   razorpayPaymentId: razorpay_payment_id,
    //   paidAt: new Date() 
    // });

    // Credit user wallet / fulfill order
    // await creditUserWallet(userId, amount);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amount: paymentDetails.amount / 100, // Convert paise to rupees
      method: paymentDetails.method,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Step 3: Webhook Handler (optional but recommended)
 * POST /api/payment/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body.toString();

    // Verify webhook signature
    if (process.env.RAZORPAY_WEBHOOK_SECRET) {
      const isValid = razorpayService.verifyWebhookSignature(body, signature);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = JSON.parse(body);
    console.log('Razorpay webhook event:', event.event);

    // Handle different events
    switch (event.event) {
      case 'payment.captured':
        const payment = event.payload.payment.entity;
        console.log('Payment captured:', payment.id);
        // Update your database
        break;

      case 'payment.failed':
        const failedPayment = event.payload.payment.entity;
        console.log('Payment failed:', failedPayment.id);
        // Handle failed payment
        break;

      case 'refund.created':
        const refund = event.payload.refund.entity;
        console.log('Refund created:', refund.id);
        // Handle refund
        break;

      default:
        console.log('Unhandled event:', event.event);
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## 6. Frontend Implementation

### 6.1 React Component

```jsx
import React, { useState } from 'react';

const RAZORPAY_KEY_ID = 'rzp_test_XXXXXXXXXXXX'; // Or fetch from backend

function RazorpayCheckout({ amount, orderId, customerName, customerEmail, customerPhone, onSuccess, onFailure }) {
  const [loading, setLoading] = useState(false);

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setLoading(true);

    try {
      // Step 1: Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay SDK');
      }

      // Step 2: Create order on backend
      const orderResponse = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          orderId,
          customerName,
          customerEmail,
          customerPhone,
        }),
      });

      const orderData = await orderResponse.json();
      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Step 3: Open Razorpay Checkout
      const options = {
        key: orderData.keyId || RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Your Company Name',
        description: `Payment for Order ${orderId}`,
        order_id: orderData.orderId,
        prefill: orderData.prefill,
        theme: {
          color: '#3399cc',
        },
        handler: async function (response) {
          // Step 4: Verify payment on backend
          try {
            const verifyResponse = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId: orderId,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              onSuccess && onSuccess(verifyData);
            } else {
              onFailure && onFailure(verifyData.error);
            }
          } catch (error) {
            onFailure && onFailure(error.message);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            console.log('Payment modal closed');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

      razorpay.on('payment.failed', function (response) {
        onFailure && onFailure(response.error.description);
      });

    } catch (error) {
      console.error('Payment error:', error);
      onFailure && onFailure(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePayment} 
      disabled={loading}
      style={{
        padding: '12px 24px',
        backgroundColor: '#3399cc',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Processing...' : `Pay ₹${amount}`}
    </button>
  );
}

export default RazorpayCheckout;
```

### 6.2 Usage Example

```jsx
function PaymentPage() {
  const handleSuccess = (data) => {
    alert(`Payment successful! Payment ID: ${data.paymentId}`);
    // Redirect to success page
    window.location.href = '/payment-success';
  };

  const handleFailure = (error) => {
    alert(`Payment failed: ${error}`);
  };

  return (
    <RazorpayCheckout
      amount={100}
      orderId="ORDER_123"
      customerName="John Doe"
      customerEmail="john@example.com"
      customerPhone="9999999999"
      onSuccess={handleSuccess}
      onFailure={handleFailure}
    />
  );
}
```

---

## 7. Signature Validation

### Why Signature Validation is Critical

**NEVER trust client-side data directly!** Always verify the signature server-side before crediting money.

### Payment Signature Formula

```
signature = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
```

### Implementation

```javascript
const crypto = require('crypto');

function verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature) {
  // Create the expected signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  // Compare signatures
  const isValid = expectedSignature === razorpay_signature;
  
  console.log('Signature verification:', isValid ? 'VALID' : 'INVALID');
  
  return isValid;
}

// Usage in your verify endpoint
if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
  return res.status(400).json({ error: 'Invalid signature - possible tampering!' });
}
```

### Webhook Signature Formula

```
signature = HMAC_SHA256(webhook_body, webhook_secret)
```

---

## 8. Webhook Setup

### 8.1 Configure in Razorpay Dashboard

1. Go to **Dashboard → Settings → Webhooks**
2. Click **Add New Webhook**
3. Enter your webhook URL: `https://yourdomain.com/api/payment/webhook`
4. Select events to subscribe:
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
5. Copy the **Webhook Secret** to your `.env`

### 8.2 Important Events

| Event | Description |
|-------|-------------|
| `payment.authorized` | Payment authorized but not captured |
| `payment.captured` | Payment successfully captured |
| `payment.failed` | Payment failed |
| `order.paid` | Order fully paid |
| `refund.created` | Refund initiated |
| `refund.processed` | Refund completed |

---

## 9. Testing

### Test Card Details

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa (Success) | `4111 1111 1111 1111` | Any 3 digits | Any future date |
| Mastercard (Success) | `5267 3181 8797 5449` | Any 3 digits | Any future date |
| Failure Card | `4111 1111 1111 1234` | Any 3 digits | Any future date |

### Test UPI

- VPA: `success@razorpay` (for success)
- VPA: `failure@razorpay` (for failure)

### Test Netbanking

- Select any bank
- OTP: `1234`

### Test Wallet

- Any mobile number
- OTP: `1234`

---

## 10. Production Checklist

- [ ] Switch from test keys to live keys
- [ ] Enable HTTPS on your server
- [ ] Set up webhook with proper secret
- [ ] Implement proper error handling and logging
- [ ] Add retry logic for failed API calls
- [ ] Store transaction logs in database
- [ ] Set up monitoring and alerts
- [ ] Test refund flow
- [ ] Handle duplicate webhooks (idempotency)
- [ ] Implement rate limiting

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `BAD_REQUEST_ERROR: Authentication failed` | Invalid API credentials | Verify Key ID and Secret |
| `BAD_REQUEST_ERROR: The amount must be atleast INR 1.00` | Amount less than minimum | Ensure amount >= 1 |
| `Signature mismatch` | Wrong secret or tampered data | Verify using correct secret |
| `Order already paid` | Duplicate payment attempt | Check order status before processing |

---

## Support

- Documentation: https://razorpay.com/docs/
- API Reference: https://razorpay.com/docs/api/
- Test Dashboard: https://dashboard.razorpay.com/app/test/dashboard

---

## Payment Flow Diagram

```
┌─────────────┐     1. Create Order      ┌─────────────┐
│   Frontend  │ ──────────────────────▶  │   Backend   │
│   (React)   │                          │   (Node.js) │
└─────────────┘                          └─────────────┘
       │                                        │
       │                                        │ 2. razorpay.orders.create()
       │                                        ▼
       │                                 ┌─────────────┐
       │                                 │  Razorpay   │
       │                                 │    API      │
       │                                 └─────────────┘
       │                                        │
       │  3. Return order_id, key_id           │
       │ ◀──────────────────────────────────────
       │
       │ 4. Open Razorpay Checkout
       ▼
┌─────────────┐
│  Razorpay   │
│  Checkout   │
│   Modal     │
└─────────────┘
       │
       │ 5. User completes payment
       │
       │ 6. razorpay_order_id, razorpay_payment_id, razorpay_signature
       ▼
┌─────────────┐     7. Verify Signature   ┌─────────────┐
│   Frontend  │ ──────────────────────▶   │   Backend   │
└─────────────┘                           └─────────────┘
                                                 │
                                                 │ 8. HMAC-SHA256 verification
                                                 │ 9. Fetch payment details
                                                 │ 10. Credit wallet / fulfill order
                                                 │
       ┌─────────────────────────────────────────┘
       │ 11. Success response
       ▼
┌─────────────┐
│   Success   │
│    Page     │
└─────────────┘
```

---

*Last Updated: January 2026*

