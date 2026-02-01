# PayU Payment Gateway Integration Guide

PayU (PayUbiz/PayUmoney) is one of India's leading payment gateways, offering card payments, UPI, netbanking, wallets, and EMI options.

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Get API Credentials](#get-api-credentials)
4. [Environment Setup](#environment-setup)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Hash Generation](#hash-generation)
8. [Webhook Setup](#webhook-setup)
9. [Testing](#testing)
10. [Production Checklist](#production-checklist)

---

## 1. Overview

### PayU Features
- Credit/Debit Cards (Visa, Mastercard, RuPay, Amex, Diners)
- UPI (all apps)
- Net Banking (100+ banks)
- Wallets (Paytm, PhonePe, etc.)
- EMI (Card EMI, Bajaj Finserv, etc.)
- International Cards

### Integration Types
1. **Hosted Checkout** - Redirect to PayU's payment page (Recommended)
2. **Seamless Integration** - Custom payment form on your site
3. **S2S (Server-to-Server)** - API-only integration

This guide covers **Hosted Checkout** (most common).

---

## 2. Prerequisites

- Node.js 16+ installed
- PayUbiz merchant account
- HTTPS endpoint (required for production)
- Understanding of hash-based verification

---

## 3. Get API Credentials

### Step 1: Create PayU Account
1. Go to https://payu.in/business
2. Click "Sign Up" or contact sales
3. Complete merchant onboarding
4. Verify your business (KYC)

### Step 2: Access Dashboard
1. **Test Dashboard**: https://test.payumoney.com (or https://test.payu.in)
2. **Production Dashboard**: https://payumoney.com (or https://payu.in)

### Step 3: Get Credentials
From Dashboard → Settings → API Configuration:
- **Merchant Key** - Your unique merchant identifier
- **Merchant Salt (Salt v1)** - For hash generation
- **Auth Header** (optional) - For some APIs

### Important: Salt Versions
PayU has different salt versions:
- **Salt v1** - Most common, used in this guide
- **Salt v2** - Enhanced security (contact PayU to enable)

---

## 4. Environment Setup

Add these variables to your `.env` file:

```env
# ================================================================================
# PAYU PAYMENT GATEWAY
# ================================================================================

# Environment: false = Test, true = Production
PAYU_PRODUCTION=false

# API Credentials (from PayU Dashboard → Settings → API Configuration)
PAYU_MERCHANT_KEY=your_merchant_key
PAYU_MERCHANT_SALT=your_merchant_salt_v1

# Optional: Salt v2 (if enabled on your account)
# PAYU_MERCHANT_SALT_V2=your_merchant_salt_v2

# API URLs (automatically selected based on PAYU_PRODUCTION)
# Test: https://test.payu.in/_payment
# Production: https://secure.payu.in/_payment

# Callback URLs (Must be HTTPS in production)
PAYU_SUCCESS_URL=https://yourdomain.com/api/payu/success
PAYU_FAILURE_URL=https://yourdomain.com/api/payu/failure
PAYU_CANCEL_URL=https://yourdomain.com/api/payu/cancel

# Your application URLs
FRONTEND_URL=http://localhost:5000
BACKEND_URL=http://localhost:4100
```

---

## 5. Backend Implementation

### Step 1: Install Dependencies

```bash
npm install crypto
```

### Step 2: Create PayU Service

```typescript
// services/payu.service.ts

import crypto from 'crypto';

interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  baseUrl: string;
  environment: 'test' | 'production';
}

interface CreateOrderParams {
  txnId: string;
  amount: number;
  productInfo: string;
  firstName: string;
  email: string;
  phone: string;
  successUrl?: string;
  failureUrl?: string;
  udf1?: string;  // User defined fields
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

interface PaymentFormData {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

interface VerifyPaymentParams {
  txnId: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  status: string;
  hash: string;
  // Additional fields from PayU response
  mihpayid?: string;
  mode?: string;
  unmappedstatus?: string;
  cardCategory?: string;
  bankcode?: string;
  PG_TYPE?: string;
  card_type?: string;
}

class PayUService {
  private config: PayUConfig | null = null;

  constructor() {
    this.initializeFromEnv();
  }

  private initializeFromEnv() {
    const merchantKey = process.env.PAYU_MERCHANT_KEY;
    const merchantSalt = process.env.PAYU_MERCHANT_SALT;
    const isProduction = process.env.PAYU_PRODUCTION === 'true';

    if (merchantKey && merchantSalt) {
      this.config = {
        merchantKey,
        merchantSalt,
        baseUrl: isProduction 
          ? 'https://secure.payu.in/_payment' 
          : 'https://test.payu.in/_payment',
        environment: isProduction ? 'production' : 'test',
      };

      console.log(`PayU service initialized (${this.config.environment} mode)`);
    } else {
      console.warn('PayU credentials not configured');
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getPaymentUrl(): string {
    return this.config?.baseUrl || '';
  }

  getMerchantKey(): string {
    return this.config?.merchantKey || '';
  }

  /**
   * Generate Hash for Payment Request
   * 
   * PayU Hash Formula (Salt v1):
   * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
   */
  generatePaymentHash(params: CreateOrderParams): string {
    if (!this.config) {
      throw new Error('PayU is not configured');
    }

    const hashString = [
      this.config.merchantKey,
      params.txnId,
      params.amount.toFixed(2),
      params.productInfo,
      params.firstName,
      params.email,
      params.udf1 || '',
      params.udf2 || '',
      params.udf3 || '',
      params.udf4 || '',
      params.udf5 || '',
      '', '', '', '', '', // Reserved fields (udf6-10 always empty in hash)
      this.config.merchantSalt,
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  /**
   * Verify Response Hash
   * 
   * PayU Response Hash Formula (Salt v1):
   * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   * 
   * Note: This is REVERSE order compared to payment hash
   */
  verifyResponseHash(params: VerifyPaymentParams): boolean {
    if (!this.config) {
      throw new Error('PayU is not configured');
    }

    // Extract UDFs from params (they might be in additionalCharges format)
    const udf1 = (params as any).udf1 || '';
    const udf2 = (params as any).udf2 || '';
    const udf3 = (params as any).udf3 || '';
    const udf4 = (params as any).udf4 || '';
    const udf5 = (params as any).udf5 || '';

    // Response hash is calculated in REVERSE order
    const hashString = [
      this.config.merchantSalt,
      params.status,
      '', '', '', '', '', // Reserved fields
      udf5,
      udf4,
      udf3,
      udf2,
      udf1,
      params.email,
      params.firstname,
      params.productinfo,
      params.amount,
      params.txnId,
      this.config.merchantKey,
    ].join('|');

    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    return calculatedHash.toLowerCase() === params.hash.toLowerCase();
  }

  /**
   * Prepare Payment Form Data
   */
  preparePaymentForm(params: CreateOrderParams): PaymentFormData {
    if (!this.config) {
      throw new Error('PayU is not configured');
    }

    const hash = this.generatePaymentHash(params);

    return {
      key: this.config.merchantKey,
      txnid: params.txnId,
      amount: params.amount.toFixed(2),
      productinfo: params.productInfo,
      firstname: params.firstName,
      email: params.email,
      phone: params.phone,
      surl: params.successUrl || process.env.PAYU_SUCCESS_URL || '',
      furl: params.failureUrl || process.env.PAYU_FAILURE_URL || '',
      hash,
      udf1: params.udf1 || '',
      udf2: params.udf2 || '',
      udf3: params.udf3 || '',
      udf4: params.udf4 || '',
      udf5: params.udf5 || '',
    };
  }

  /**
   * Map PayU status to application status
   */
  mapStatus(status: string): 'PENDING' | 'SUCCESS' | 'FAILED' {
    const statusMap: Record<string, 'PENDING' | 'SUCCESS' | 'FAILED'> = {
      'success': 'SUCCESS',
      'captured': 'SUCCESS',
      'failure': 'FAILED',
      'failed': 'FAILED',
      'cancelled': 'FAILED',
      'pending': 'PENDING',
      'initiated': 'PENDING',
      'bounced': 'FAILED',
      'dropped': 'FAILED',
      'userCancelled': 'FAILED',
    };

    return statusMap[status?.toLowerCase()] || 'PENDING';
  }

  /**
   * Get card type info from PayU response
   */
  getCardTypeInfo(response: any): {
    cardNetwork: string;
    cardCategory: string;
    cardType: string;
    paymentMode: string;
  } {
    return {
      cardNetwork: response.bankcode || response.cardnum?.substring(0, 4) || 'UNKNOWN',
      cardCategory: response.cardCategory || 'NORMAL',
      cardType: response.card_type || 'UNKNOWN',
      paymentMode: response.mode || response.PG_TYPE || 'UNKNOWN',
    };
  }

  /**
   * Verify Transaction via API
   * Use this for server-side verification
   */
  async verifyTransactionViaAPI(txnId: string): Promise<any> {
    if (!this.config) {
      throw new Error('PayU is not configured');
    }

    const command = 'verify_payment';
    const hashString = `${this.config.merchantKey}|${command}|${txnId}|${this.config.merchantSalt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const apiUrl = this.config.environment === 'production'
      ? 'https://info.payu.in/merchant/postservice.php?form=2'
      : 'https://test.payu.in/merchant/postservice.php?form=2';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          key: this.config.merchantKey,
          command,
          var1: txnId,
          hash,
        }).toString(),
      });

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('PayU API verification error:', error);
      throw error;
    }
  }
}

export const payuService = new PayUService();
```

### Step 3: Create API Routes

```typescript
// routes/payu.routes.ts

import { Router } from 'express';
import { payuService } from '../services/payu.service';

const router = Router();

/**
 * Initiate Payment
 * POST /api/payu/initiate
 * Returns form data to be submitted to PayU
 */
router.post('/initiate', async (req, res) => {
  try {
    const { 
      txnId, 
      amount, 
      productInfo, 
      firstName, 
      email, 
      phone,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    } = req.body;

    if (!txnId || !amount || !productInfo || !firstName || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: txnId, amount, productInfo, firstName, email' 
      });
    }

    const formData = payuService.preparePaymentForm({
      txnId,
      amount: Number(amount),
      productInfo,
      firstName,
      email,
      phone: phone || '9999999999',
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    });

    res.json({
      success: true,
      data: {
        paymentUrl: payuService.getPaymentUrl(),
        formData,
      },
    });
  } catch (error: any) {
    console.error('PayU initiate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Success Callback (POST from PayU)
 * POST /api/payu/success
 */
router.post('/success', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('PayU Success Callback:', {
      txnid: payload.txnid,
      status: payload.status,
      mihpayid: payload.mihpayid,
    });

    // Verify hash
    const isValid = payuService.verifyResponseHash({
      txnId: payload.txnid,
      amount: payload.amount,
      productinfo: payload.productinfo,
      firstname: payload.firstname,
      email: payload.email,
      status: payload.status,
      hash: payload.hash,
    });

    if (!isValid) {
      console.error('Invalid PayU response hash!');
      return res.redirect(`${process.env.FRONTEND_URL}/payment-status?status=failed&error=hash_mismatch`);
    }

    const status = payuService.mapStatus(payload.status);
    const cardInfo = payuService.getCardTypeInfo(payload);

    // TODO: Update your database
    // await updateTransaction(payload.txnid, status, payload);

    // Redirect to frontend
    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/payment-status`);
    redirectUrl.searchParams.set('txn_id', payload.txnid);
    redirectUrl.searchParams.set('status', status);
    redirectUrl.searchParams.set('payu_id', payload.mihpayid || '');
    redirectUrl.searchParams.set('mode', cardInfo.paymentMode);

    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('PayU success callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-status?status=failed&error=processing_error`);
  }
});

/**
 * Failure Callback (POST from PayU)
 * POST /api/payu/failure
 */
router.post('/failure', async (req, res) => {
  try {
    const payload = req.body;
    
    console.log('PayU Failure Callback:', {
      txnid: payload.txnid,
      status: payload.status,
      error_Message: payload.error_Message,
    });

    // Verify hash (even for failures)
    const isValid = payuService.verifyResponseHash({
      txnId: payload.txnid,
      amount: payload.amount,
      productinfo: payload.productinfo,
      firstname: payload.firstname,
      email: payload.email,
      status: payload.status,
      hash: payload.hash,
    });

    if (!isValid) {
      console.error('Invalid PayU response hash on failure!');
    }

    // TODO: Update your database
    // await updateTransaction(payload.txnid, 'FAILED', payload);

    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/payment-status`);
    redirectUrl.searchParams.set('txn_id', payload.txnid);
    redirectUrl.searchParams.set('status', 'failed');
    redirectUrl.searchParams.set('error', payload.error_Message || 'Payment failed');

    res.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('PayU failure callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-status?status=failed&error=processing_error`);
  }
});

/**
 * Verify Transaction Status (Manual Check)
 * GET /api/payu/verify/:txnId
 */
router.get('/verify/:txnId', async (req, res) => {
  try {
    const { txnId } = req.params;

    const result = await payuService.verifyTransactionViaAPI(txnId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('PayU verify error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

---

## 6. Frontend Implementation

### Auto-Submit Form to PayU

```tsx
// components/PayUPayment.tsx

import { useState, useEffect, useRef } from 'react';

interface PaymentFormData {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
}

export function PayUPayment() {
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PaymentFormData | null>(null);
  const [paymentUrl, setPaymentUrl] = useState('');
  
  const [amount, setAmount] = useState('100');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Auto-submit form when data is ready
  useEffect(() => {
    if (formData && formRef.current) {
      formRef.current.submit();
    }
  }, [formData]);

  const initiatePayment = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/payu/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnId: `TXN_${Date.now()}`,
          amount: parseFloat(amount),
          productInfo: 'Wallet Recharge',
          firstName,
          email,
          phone,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      // Set form data and URL - form will auto-submit
      setPaymentUrl(data.data.paymentUrl);
      setFormData(data.data.formData);
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="payment-form">
      <h2>Pay with PayU</h2>
      
      {!formData ? (
        <>
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          
          <input
            type="tel"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          
          <button onClick={initiatePayment} disabled={loading}>
            {loading ? 'Redirecting to PayU...' : `Pay ₹${amount}`}
          </button>
        </>
      ) : (
        <div>
          <p>Redirecting to PayU...</p>
          
          {/* Hidden form that auto-submits to PayU */}
          <form ref={formRef} method="POST" action={paymentUrl}>
            <input type="hidden" name="key" value={formData.key} />
            <input type="hidden" name="txnid" value={formData.txnid} />
            <input type="hidden" name="amount" value={formData.amount} />
            <input type="hidden" name="productinfo" value={formData.productinfo} />
            <input type="hidden" name="firstname" value={formData.firstname} />
            <input type="hidden" name="email" value={formData.email} />
            <input type="hidden" name="phone" value={formData.phone} />
            <input type="hidden" name="surl" value={formData.surl} />
            <input type="hidden" name="furl" value={formData.furl} />
            <input type="hidden" name="hash" value={formData.hash} />
          </form>
        </div>
      )}
    </div>
  );
}
```

---

## 7. Hash Generation

### Payment Request Hash (Salt v1)

```
sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
```

**Example:**
```
key = "gtKFFx"
txnid = "TXN123"
amount = "100.00"
productinfo = "Product"
firstname = "John"
email = "john@example.com"
udf1-5 = "" (empty)
salt = "eCwWELxi"

hashString = "gtKFFx|TXN123|100.00|Product|John|john@example.com|||||||||||eCwWELxi"
hash = sha512(hashString)
```

### Response Verification Hash (Salt v1)

**IMPORTANT: Response hash is calculated in REVERSE order!**

```
sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
```

**Example:**
```
salt = "eCwWELxi"
status = "success"
key = "gtKFFx"

hashString = "eCwWELxi|success|||||||||||john@example.com|John|Product|100.00|TXN123|gtKFFx"
expectedHash = sha512(hashString)
```

---

## 8. Webhook Setup

PayU doesn't use traditional webhooks. Instead, it sends:
1. **Success URL (surl)** - POST request on successful payment
2. **Failure URL (furl)** - POST request on failed payment

### Important Notes

- Callbacks are sent as **POST** requests with **form-urlencoded** data
- Always verify the **hash** before processing
- Store the **mihpayid** (PayU transaction ID) for future reference
- Callback might not reach if user closes browser - use verification API as backup

### Callback Parameters

| Parameter | Description |
|-----------|-------------|
| `mihpayid` | PayU transaction ID |
| `txnid` | Your transaction ID |
| `amount` | Transaction amount |
| `status` | success/failure/pending |
| `hash` | Response hash for verification |
| `mode` | Payment mode (CC/DC/NB/UPI/WALLET) |
| `bankcode` | Bank/card code |
| `cardCategory` | Card category (domestic/corporate) |
| `error_Message` | Error message (on failure) |

---

## 9. Testing

### Test Credentials

| Credential | Value |
|------------|-------|
| Merchant Key | `gtKFFx` (example) |
| Merchant Salt | `eCwWELxi` (example) |
| Test URL | `https://test.payu.in/_payment` |

*Note: Get actual test credentials from PayU dashboard*

### Test Cards

| Card Number | Expiry | CVV | Result |
|-------------|--------|-----|--------|
| 5123456789012346 | Any future | Any 3 digits | Success |
| 4012001037141112 | Any future | Any 3 digits | Success |
| 5123456789012346 | 05/20 | 123 | Failure |

### Test UPI

- UPI ID: `success@payu` → Success
- UPI ID: `failure@payu` → Failure

### Test Flow

1. Use test credentials
2. Initiate payment with test card
3. Complete 3D Secure if prompted
4. Verify callback is received
5. Verify hash matches
6. Use verification API to confirm status

---

## 10. Production Checklist

### Before Going Live

- [ ] Complete KYC with PayU
- [ ] Get production credentials
- [ ] Update `.env`:
  ```env
  PAYU_PRODUCTION=true
  PAYU_MERCHANT_KEY=<production_key>
  PAYU_MERCHANT_SALT=<production_salt>
  ```
- [ ] Update callback URLs to production domain
- [ ] Ensure HTTPS for all URLs
- [ ] Test with production credentials (small amount)
- [ ] Implement transaction verification API as backup
- [ ] Set up logging and monitoring
- [ ] Configure rate limiting

### Security Best Practices

1. **Always verify response hash** before processing
2. **Never expose salt** in frontend code
3. **Use HTTPS** for all callbacks
4. **Validate amounts** match your records
5. **Implement idempotency** for callback handling
6. **Log all transactions** for audit trail
7. **Use verification API** as backup for failed callbacks

### Common Issues

| Issue | Solution |
|-------|----------|
| Hash mismatch | Check parameter order, ensure no extra spaces |
| Callback not received | Check URL accessibility, use verification API |
| Invalid key | Verify test/production environment match |
| Amount mismatch | Use 2 decimal places (100.00 not 100) |

---

## API Reference

### Payment Status Values

| Status | Description |
|--------|-------------|
| `success` | Payment successful |
| `failure` | Payment failed |
| `pending` | Payment pending (rare) |
| `dropped` | User dropped off |
| `userCancelled` | User cancelled |
| `bounced` | Payment bounced |

### Payment Modes

| Mode | Description |
|------|-------------|
| `CC` | Credit Card |
| `DC` | Debit Card |
| `NB` | Net Banking |
| `UPI` | UPI |
| `WALLET` | Wallet (Paytm, etc.) |
| `EMI` | EMI |
| `CASH` | Cash Card |

---

## Support & Resources

- **PayU Documentation**: https://developer.payumoney.com/
- **PayU Dashboard (Test)**: https://test.payu.in/merchant
- **PayU Dashboard (Prod)**: https://payu.in/merchant
- **Support**: techsupport@payu.in

---

*Last Updated: January 2026*

