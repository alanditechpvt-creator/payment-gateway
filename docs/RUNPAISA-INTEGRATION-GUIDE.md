# Runpaisa Payment Gateway Integration Guide

Runpaisa is a **Payment Gateway Aggregator** that provides access to multiple underlying PGs (PayU, Cashfree, Razorpay, etc.) through a single API. This allows merchants to route transactions to different PGs based on success rates, costs, or preferences.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Get API Credentials](#get-api-credentials)
4. [Environment Setup](#environment-setup)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Webhook Setup](#webhook-setup)
8. [Card Type Handling](#card-type-handling)
9. [Testing](#testing)
10. [Production Checklist](#production-checklist)

---

## 1. Overview

### What is Runpaisa?

Runpaisa acts as an aggregator, meaning:
- Single integration, multiple PGs
- Automatic routing to best-performing PG
- Unified response format regardless of underlying PG
- Card type info includes internal PG name (e.g., `payu_visa-normal`, `cashfree_master-corporate`)

### Response Card Type Format

When a payment is completed, Runpaisa returns card type in this format:
```
{internalPG}_{cardNetwork}-{cardCategory}
```

Examples:
- `payu_visa-normal` - PayU, Visa, Normal card
- `cashfree_master-corporate` - Cashfree, Mastercard, Corporate card
- `razorpay_rupay-debit` - Razorpay, RuPay, Debit card

---

## 2. Prerequisites

- Node.js 16+ installed
- A Runpaisa merchant account
- HTTPS endpoint for webhooks
- Understanding of your rate structure (different rates for different card types)

---

## 3. Get API Credentials

### Step 1: Contact Runpaisa
1. Visit https://runpaisa.com or contact sales
2. Complete merchant onboarding
3. Sign agreement and complete KYC

### Step 2: Get Credentials
You will receive:
- **Client ID** - Your merchant identifier
- **API Key** - For API authentication
- **Secret Key** - For signature generation/verification
- **Webhook Secret** - For webhook signature verification
- **Test/Production URLs**

### Step 3: Test Environment Access
Request access to:
- Sandbox API URL
- Test merchant dashboard
- Test credentials

---

## 4. Environment Setup

Add these variables to your `.env` file:

```env
# ================================================================================
# RUNPAISA PAYMENT GATEWAY (Aggregator)
# ================================================================================

# Environment: false = Sandbox (Test), true = Production
RUNPAISA_PRODUCTION=false

# API Credentials (from Runpaisa Dashboard)
RUNPAISA_CLIENT_ID=your_client_id
RUNPAISA_API_KEY=your_api_key
RUNPAISA_SECRET_KEY=your_secret_key
RUNPAISA_WEBHOOK_SECRET=your_webhook_secret

# API URLs
RUNPAISA_API_URL_SANDBOX=https://sandbox.runpaisa.com/api/v1
RUNPAISA_API_URL_PRODUCTION=https://api.runpaisa.com/api/v1

# Callback URLs (Must be whitelisted in Runpaisa Dashboard)
RUNPAISA_RETURN_URL=https://yourdomain.com/payment-status
RUNPAISA_WEBHOOK_URL=https://yourdomain.com/api/runpaisa/webhook

# Your application URLs
FRONTEND_URL=http://localhost:5000
BACKEND_URL=http://localhost:4100
```

---

## 5. Backend Implementation

### Step 1: Install Dependencies

```bash
npm install crypto axios
```

### Step 2: Create Runpaisa Service

```typescript
// services/runpaisa.service.ts

import crypto from 'crypto';
import axios from 'axios';

interface RunpaisaConfig {
  clientId: string;
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface CreateOrderParams {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl?: string;
  webhookUrl?: string;
  description?: string;
}

interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  runpaisaOrderId?: string;
  paymentUrl?: string;
  error?: string;
}

interface OrderStatusResponse {
  success: boolean;
  orderId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
  amount: number;
  internalPG?: string;
  cardType?: string;
  cardNetwork?: string;
  cardCategory?: string;
  cardLast4?: string;
  paymentMethod?: string;
  rawResponse?: any;
}

class RunpaisaService {
  private config: RunpaisaConfig | null = null;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv() {
    const clientId = process.env.RUNPAISA_CLIENT_ID;
    const apiKey = process.env.RUNPAISA_API_KEY;
    const secretKey = process.env.RUNPAISA_SECRET_KEY;
    const webhookSecret = process.env.RUNPAISA_WEBHOOK_SECRET;
    const isProduction = process.env.RUNPAISA_PRODUCTION === 'true';

    if (clientId && apiKey && secretKey) {
      this.config = {
        clientId,
        apiKey,
        secretKey,
        webhookSecret: webhookSecret || secretKey,
        baseUrl: isProduction 
          ? (process.env.RUNPAISA_API_URL_PRODUCTION || 'https://api.runpaisa.com/api/v1')
          : (process.env.RUNPAISA_API_URL_SANDBOX || 'https://sandbox.runpaisa.com/api/v1'),
        environment: isProduction ? 'production' : 'sandbox',
      };

      console.log(`Runpaisa service initialized (${this.config.environment} mode)`);
    } else {
      console.warn('Runpaisa credentials not configured');
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Generate signature for API request
   * Format: HMAC-SHA256(sortedParams, secretKey)
   */
  private generateSignature(params: Record<string, any>): string {
    if (!this.config) throw new Error('Runpaisa not configured');

    // Sort parameters alphabetically and create string
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(signatureString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: Record<string, any>, receivedSignature: string): boolean {
    if (!this.config) return false;

    try {
      // Remove signature from payload for verification
      const { signature, ...params } = payload;
      const expectedSignature = this.generateSignature(params);
      
      return expectedSignature === receivedSignature;
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      return false;
    }
  }

  /**
   * Create Payment Order
   * API: POST /orders/create
   */
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
    if (!this.config) {
      throw new Error('Runpaisa is not configured');
    }

    try {
      const orderPayload = {
        client_id: this.config.clientId,
        order_id: params.orderId,
        amount: params.amount,
        currency: 'INR',
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        return_url: params.returnUrl || process.env.RUNPAISA_RETURN_URL,
        webhook_url: params.webhookUrl || process.env.RUNPAISA_WEBHOOK_URL,
        description: params.description || `Payment for order ${params.orderId}`,
        timestamp: Date.now(),
      };

      // Add signature
      const signature = this.generateSignature(orderPayload);

      const response = await axios.post(
        `${this.config.baseUrl}/orders/create`,
        { ...orderPayload, signature },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      if (response.data.success) {
        console.log(`Runpaisa order created: ${response.data.data.runpaisa_order_id}`);
        
        return {
          success: true,
          orderId: params.orderId,
          runpaisaOrderId: response.data.data.runpaisa_order_id,
          paymentUrl: response.data.data.payment_url,
        };
      } else {
        return {
          success: false,
          orderId: params.orderId,
          error: response.data.message || 'Failed to create order',
        };
      }
    } catch (error: any) {
      console.error('Runpaisa create order error:', error.response?.data || error.message);
      return {
        success: false,
        orderId: params.orderId,
        error: error.response?.data?.message || error.message || 'Failed to create order',
      };
    }
  }

  /**
   * Get Order Status
   * API: GET /orders/{orderId}/status
   */
  async getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
    if (!this.config) {
      throw new Error('Runpaisa is not configured');
    }

    try {
      const timestamp = Date.now();
      const params = {
        client_id: this.config.clientId,
        order_id: orderId,
        timestamp,
      };
      const signature = this.generateSignature(params);

      const response = await axios.get(
        `${this.config.baseUrl}/orders/${orderId}/status`,
        {
          params: { ...params, signature },
          headers: {
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      const data = response.data.data;

      // Parse card type info from Runpaisa format: {internalPG}_{cardNetwork}-{cardCategory}
      const cardTypeInfo = this.parseCardType(data.card_type);

      return {
        success: true,
        orderId: data.order_id,
        status: this.mapStatus(data.status),
        amount: data.amount,
        internalPG: cardTypeInfo?.internalPG,
        cardType: data.card_type,
        cardNetwork: cardTypeInfo?.cardNetwork || data.card_network,
        cardCategory: cardTypeInfo?.cardCategory || data.card_category,
        cardLast4: data.card_last4,
        paymentMethod: data.payment_method,
        rawResponse: data,
      };
    } catch (error: any) {
      console.error('Runpaisa get order status error:', error.response?.data || error.message);
      return {
        success: false,
        orderId,
        status: 'PENDING',
        amount: 0,
        rawResponse: error.response?.data,
      };
    }
  }

  /**
   * Parse Runpaisa card type format
   * Input: "payu_visa-normal" or "cashfree_master-corporate"
   * Output: { internalPG: "payu", cardNetwork: "visa", cardCategory: "normal" }
   */
  parseCardType(cardType: string): { internalPG: string; cardNetwork: string; cardCategory: string } | null {
    if (!cardType) return null;

    try {
      // Format: {internalPG}_{cardNetwork}-{cardCategory}
      const underscoreIndex = cardType.indexOf('_');
      if (underscoreIndex === -1) return null;

      const internalPG = cardType.substring(0, underscoreIndex);
      const rest = cardType.substring(underscoreIndex + 1);
      
      const dashIndex = rest.indexOf('-');
      if (dashIndex === -1) {
        return {
          internalPG,
          cardNetwork: rest,
          cardCategory: 'normal',
        };
      }

      return {
        internalPG,
        cardNetwork: rest.substring(0, dashIndex),
        cardCategory: rest.substring(dashIndex + 1),
      };
    } catch (error) {
      console.error('Error parsing card type:', cardType, error);
      return null;
    }
  }

  /**
   * Map Runpaisa status to application status
   */
  mapStatus(status: string): 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING' {
    const statusMap: Record<string, 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING'> = {
      'CREATED': 'PENDING',
      'PENDING': 'PENDING',
      'PROCESSING': 'PROCESSING',
      'SUCCESS': 'SUCCESS',
      'COMPLETED': 'SUCCESS',
      'PAID': 'SUCCESS',
      'FAILED': 'FAILED',
      'CANCELLED': 'FAILED',
      'EXPIRED': 'FAILED',
      'REFUNDED': 'FAILED',
    };

    return statusMap[status?.toUpperCase()] || 'PENDING';
  }

  /**
   * Process webhook payload
   */
  processWebhook(payload: any): {
    orderId: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'PROCESSING';
    amount: number;
    cardType?: string;
    internalPG?: string;
    cardNetwork?: string;
    cardCategory?: string;
    rawData: any;
  } {
    const cardTypeInfo = this.parseCardType(payload.card_type);

    return {
      orderId: payload.order_id,
      status: this.mapStatus(payload.status),
      amount: payload.amount,
      cardType: payload.card_type,
      internalPG: cardTypeInfo?.internalPG,
      cardNetwork: cardTypeInfo?.cardNetwork || payload.card_network,
      cardCategory: cardTypeInfo?.cardCategory || payload.card_category,
      rawData: payload,
    };
  }
}

export const runpaisaService = new RunpaisaService();
```

### Step 3: Create API Routes

```typescript
// routes/runpaisa.routes.ts

import { Router } from 'express';
import { runpaisaService } from '../services/runpaisa.service';

const router = Router();

/**
 * Create Order
 * POST /api/runpaisa/create-order
 */
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, amount, customerName, customerEmail, customerPhone, description } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ success: false, error: 'orderId and amount are required' });
    }

    const result = await runpaisaService.createOrder({
      orderId,
      amount: Number(amount),
      customerName,
      customerEmail,
      customerPhone,
      description,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      data: {
        orderId: result.orderId,
        runpaisaOrderId: result.runpaisaOrderId,
        paymentUrl: result.paymentUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get Order Status
 * GET /api/runpaisa/status/:orderId
 */
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await runpaisaService.getOrderStatus(orderId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Webhook Handler
 * POST /api/runpaisa/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    const receivedSignature = payload.signature || req.headers['x-signature'];

    // Verify signature
    if (!runpaisaService.verifyWebhookSignature(payload, receivedSignature)) {
      console.warn('Invalid Runpaisa webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData = runpaisaService.processWebhook(payload);

    console.log('Runpaisa webhook received:', {
      orderId: webhookData.orderId,
      status: webhookData.status,
      cardType: webhookData.cardType,
      internalPG: webhookData.internalPG,
    });

    // Process based on status
    switch (webhookData.status) {
      case 'SUCCESS':
        console.log(`Payment SUCCESS for order: ${webhookData.orderId}`);
        // TODO: Update transaction status to SUCCESS
        // TODO: Credit user wallet
        // TODO: Store card type info for rate calculation
        break;

      case 'FAILED':
        console.log(`Payment FAILED for order: ${webhookData.orderId}`);
        // TODO: Update transaction status to FAILED
        break;

      case 'PROCESSING':
        console.log(`Payment PROCESSING for order: ${webhookData.orderId}`);
        // TODO: Update transaction status to PROCESSING
        break;

      default:
        console.log(`Payment status ${webhookData.status} for order: ${webhookData.orderId}`);
    }

    // Respond with success
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Runpaisa webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Return URL Handler (after payment redirect)
 * GET /api/runpaisa/return
 */
router.get('/return', async (req, res) => {
  try {
    const { order_id, status } = req.query;

    if (!order_id) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-status?error=missing_order_id`);
    }

    // Get latest status from Runpaisa
    const orderStatus = await runpaisaService.getOrderStatus(order_id as string);

    // Redirect to frontend with status
    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/payment-status`);
    redirectUrl.searchParams.set('order_id', order_id as string);
    redirectUrl.searchParams.set('status', orderStatus.status);
    
    if (orderStatus.cardType) {
      redirectUrl.searchParams.set('card_type', orderStatus.cardType);
    }

    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('Return URL handler error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-status?error=verification_failed`);
  }
});

export default router;
```

---

## 6. Frontend Implementation

### Payment Initiation

```tsx
// components/RunpaisaPayment.tsx

import { useState } from 'react';

export function RunpaisaPayment() {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('100');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const initiatePayment = async () => {
    setLoading(true);

    try {
      // Create order on backend
      const response = await fetch('/api/runpaisa/create-order', {
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

      // Redirect to Runpaisa payment page
      window.location.href = data.data.paymentUrl;
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-form">
      <h2>Pay with Runpaisa</h2>
      
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

## 7. Webhook Setup

### Configure Webhooks in Runpaisa Dashboard

1. Login to **Runpaisa Merchant Dashboard**
2. Go to **Settings** → **Webhooks**
3. Add Webhook Endpoint:
   - **URL**: `https://yourdomain.com/api/runpaisa/webhook`
   - **Events**: All payment events
4. Copy the **Webhook Secret** and add to `.env`

### Webhook Payload Example

```json
{
  "order_id": "ORDER_123456",
  "runpaisa_order_id": "RP_ABC123",
  "status": "SUCCESS",
  "amount": 100.00,
  "currency": "INR",
  "card_type": "payu_visa-normal",
  "card_network": "visa",
  "card_category": "normal",
  "card_last4": "1234",
  "payment_method": "card",
  "internal_pg": "payu",
  "pg_transaction_id": "PU_TXN_789",
  "timestamp": 1705755600000,
  "signature": "abc123..."
}
```

---

## 8. Card Type Handling

### Understanding Card Types

Runpaisa returns card types in format: `{internalPG}_{cardNetwork}-{cardCategory}`

| Card Type | Internal PG | Network | Category |
|-----------|-------------|---------|----------|
| `payu_visa-normal` | PayU | Visa | Normal |
| `payu_visa-corporate` | PayU | Visa | Corporate |
| `cashfree_master-normal` | Cashfree | Mastercard | Normal |
| `cashfree_master-corporate` | Cashfree | Mastercard | Corporate |
| `razorpay_rupay-debit` | Razorpay | RuPay | Debit |
| `payu_amex-normal` | PayU | Amex | Normal |

### Rate Calculation Based on Card Type

```typescript
// Example rate structure
const cardTypeRates: Record<string, number> = {
  // Visa
  'visa-normal': 0.018,      // 1.8%
  'visa-corporate': 0.022,   // 2.2%
  
  // Mastercard
  'master-normal': 0.018,    // 1.8%
  'master-corporate': 0.022, // 2.2%
  
  // RuPay
  'rupay-debit': 0.009,      // 0.9%
  'rupay-credit': 0.015,     // 1.5%
  
  // Amex
  'amex-normal': 0.025,      // 2.5%
  'amex-corporate': 0.030,   // 3.0%
};

function calculateRate(cardType: string): number {
  const parsed = runpaisaService.parseCardType(cardType);
  if (!parsed) return 0.02; // Default 2%
  
  const key = `${parsed.cardNetwork}-${parsed.cardCategory}`;
  return cardTypeRates[key] || 0.02;
}
```

---

## 9. Testing

### Test Flow

1. Create order with test credentials
2. Complete payment on Runpaisa test page
3. Verify webhook is received
4. Check card type parsing
5. Verify rate calculation

### Test Cards

Contact Runpaisa support for test card numbers specific to their sandbox.

---

## 10. Production Checklist

### Before Going Live

- [ ] Complete KYC with Runpaisa
- [ ] Get production credentials
- [ ] Update `.env` with production values
- [ ] Set up production webhook URL
- [ ] Whitelist production return URL
- [ ] Configure card type specific rates
- [ ] Test with production credentials (small amount)
- [ ] Implement proper error handling
- [ ] Set up logging and monitoring

### Security Best Practices

1. **Verify all webhook signatures**
2. **Never expose secret key** in frontend
3. **Store card type** for rate calculation
4. **Validate amounts** on backend
5. **Log all transactions** with card type info

---

## Support & Resources

- **Runpaisa Dashboard**: Contact your Runpaisa account manager
- **API Documentation**: Provided during onboarding
- **Support**: Contact your account manager

---

*Last Updated: January 2026*

