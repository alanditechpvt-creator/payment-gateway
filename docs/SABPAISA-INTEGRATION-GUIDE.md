# SabPaisa Payment Gateway Integration Guide

This guide provides step-by-step instructions to integrate SabPaisa payment gateway into any Node.js application.

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Get Credentials from SabPaisa](#2-get-credentials-from-sabpaisa)
3. [Environment Setup](#3-environment-setup)
4. [Install Dependencies](#4-install-dependencies)
5. [Encryption Implementation](#5-encryption-implementation)
6. [Create Payment Request](#6-create-payment-request)
7. [Frontend Integration](#7-frontend-integration)
8. [Handle Callback/Webhook](#8-handle-callbackwebhook)
9. [Testing](#9-testing)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

- Node.js 16+ installed
- Basic understanding of Express.js or similar framework
- HTTPS domain for production (callbacks require secure URL)

---

## 2. Get Credentials from SabPaisa

Contact SabPaisa to get the following credentials:

| Credential | Description | Example |
|------------|-------------|---------|
| `clientCode` | 5-character merchant code | `DJ020` |
| `transUserName` | Transaction username | `DJL754@sp` |
| `transUserPassword` | Transaction password | `4q3qhgmJNM4m` |
| `authKey` | **BASE64 encoded** encryption key (32 bytes when decoded) | `SVNUcm1tREM...` |
| `authIV` | **BASE64 encoded** HMAC key | `TSthVUZnUk...` |

> ⚠️ **IMPORTANT:** `authKey` and `authIV` MUST be BASE64 encoded strings. If they don't look like base64 (random characters possibly ending with `=`), ask SabPaisa to provide the correct format.

---

## 3. Environment Setup

Create a `.env` file with the following variables:

```env
# SabPaisa Configuration
SABPAISA_PRODUCTION=false                    # Set to 'true' for production
SABPAISA_CLIENT_CODE=your-client-code        # 5-char alphanumeric
SABPAISA_USERNAME=your-trans-username
SABPAISA_PASSWORD=your-trans-password
SABPAISA_AUTH_KEY=your-base64-auth-key       # MUST be BASE64 encoded
SABPAISA_AUTH_IV=your-base64-auth-iv         # MUST be BASE64 encoded
SABPAISA_CALLBACK_URL=https://yourdomain.com/api/sabpaisa/callback
```

**URLs:**
- Staging: `https://stage-securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1`
- Production: `https://securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1`

---

## 4. Install Dependencies

```bash
npm install crypto dotenv
```

Optional - Install official SabPaisa encryption package for reference:
```bash
npm install sabpaisa-encryption-package-gcm
```

---

## 5. Encryption Implementation

SabPaisa uses **AES-256-GCM + HMAC-SHA384** encryption.

### Create `sabpaisa-encryption.js`:

```javascript
const crypto = require('crypto');

const IV_SIZE = 12;
const TAG_SIZE = 16;
const HMAC_LENGTH = 48;

/**
 * Encrypt data for SabPaisa
 * @param {string} plaintext - The data to encrypt
 * @param {string} authKeyBase64 - BASE64 encoded auth key
 * @param {string} authIVBase64 - BASE64 encoded auth IV
 * @returns {string} Uppercase HEX encrypted string
 */
function encrypt(plaintext, authKeyBase64, authIVBase64) {
  // Decode BASE64 keys
  const authKey = Buffer.from(authKeyBase64, 'base64');
  const authIV = Buffer.from(authIVBase64, 'base64');

  // IV is first 12 bytes of authKey
  const iv = authKey.subarray(0, IV_SIZE);

  // AES-256-GCM encryption
  const cipher = crypto.createCipheriv('aes-256-gcm', authKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine: IV + CipherText + Tag
  const encryptedMessage = Buffer.concat([iv, ciphertext, tag]);

  // HMAC-SHA384 using authIV as the key
  const hmac = crypto.createHmac('sha384', authIV)
    .update(encryptedMessage)
    .digest();

  // Final: HMAC + IV + CipherText + Tag
  const finalMessage = Buffer.concat([hmac, encryptedMessage]);
  
  return finalMessage.toString('hex').toUpperCase();
}

/**
 * Decrypt data from SabPaisa
 * @param {string} hexCiphertext - HEX encoded encrypted string
 * @param {string} authKeyBase64 - BASE64 encoded auth key
 * @param {string} authIVBase64 - BASE64 encoded auth IV
 * @returns {string} Decrypted plaintext
 */
function decrypt(hexCiphertext, authKeyBase64, authIVBase64) {
  const authKey = Buffer.from(authKeyBase64, 'base64');
  const authIV = Buffer.from(authIVBase64, 'base64');

  const fullMessage = Buffer.from(hexCiphertext, 'hex');

  // Extract HMAC and encrypted data
  const hmacReceived = fullMessage.subarray(0, HMAC_LENGTH);
  const encryptedData = fullMessage.subarray(HMAC_LENGTH);

  // Verify HMAC
  const hmacCalculated = crypto.createHmac('sha384', authIV)
    .update(encryptedData)
    .digest();

  if (!hmacReceived.equals(hmacCalculated)) {
    throw new Error('HMAC validation failed');
  }

  // Extract components
  const iv = encryptedData.subarray(0, IV_SIZE);
  const ciphertextWithTag = encryptedData.subarray(IV_SIZE);
  const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - TAG_SIZE);
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - TAG_SIZE);

  // AES-256-GCM decryption
  const decipher = crypto.createDecipheriv('aes-256-gcm', authKey, iv);
  decipher.setAuthTag(tag);
  
  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);

  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
```

---

## 6. Create Payment Request

### Create `sabpaisa-service.js`:

```javascript
const { encrypt, decrypt } = require('./sabpaisa-encryption');

class SabPaisaService {
  constructor() {
    this.clientCode = process.env.SABPAISA_CLIENT_CODE;
    this.transUserName = process.env.SABPAISA_USERNAME;
    this.transUserPassword = process.env.SABPAISA_PASSWORD;
    this.authKey = process.env.SABPAISA_AUTH_KEY;
    this.authIV = process.env.SABPAISA_AUTH_IV;
    this.callbackUrl = process.env.SABPAISA_CALLBACK_URL;
    this.isProduction = process.env.SABPAISA_PRODUCTION === 'true';
  }

  getActionUrl() {
    return this.isProduction
      ? 'https://securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1'
      : 'https://stage-securepay.sabpaisa.in/SabPaisa/sabPaisaInit?v=1';
  }

  formatDate(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
           `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  /**
   * Create payment request
   * @param {Object} params Payment parameters
   * @param {string} params.clientTxnId Unique transaction ID
   * @param {number} params.amount Payment amount
   * @param {string} params.payerName Customer name
   * @param {string} params.payerEmail Customer email
   * @param {string} params.payerMobile Customer mobile (10 digits)
   */
  createPayment(params) {
    const transDate = this.formatDate(new Date());

    // Build parameter string in EXACT order (per SabPaisa sample)
    const plainText = 
      `payerName=${params.payerName.trim()}` +
      `&payerEmail=${params.payerEmail.trim()}` +
      `&payerMobile=${params.payerMobile.trim()}` +
      `&clientTxnId=${params.clientTxnId.trim()}` +
      `&amount=${params.amount}` +
      `&clientCode=${this.clientCode.trim()}` +
      `&transUserName=${this.transUserName.trim()}` +
      `&transUserPassword=${this.transUserPassword.trim()}` +
      `&callbackUrl=${this.callbackUrl.trim()}` +
      `&channelId=W` +
      `&transDate=${transDate}`;

    // Encrypt the data
    const encData = encrypt(plainText, this.authKey, this.authIV);

    return {
      actionUrl: this.getActionUrl(),
      clientCode: this.clientCode,
      encData: encData,
      clientTxnId: params.clientTxnId
    };
  }

  /**
   * Process callback response
   * @param {string} encResponse Encrypted response from SabPaisa
   */
  processCallback(encResponse) {
    const decrypted = decrypt(encResponse, this.authKey, this.authIV);
    
    // Parse the response
    const params = {};
    decrypted.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[key] = decodeURIComponent(value || '');
    });

    return {
      success: params.status === 'SUCCESS' || params.statusCode === '0000',
      status: params.status || params.statusCode,
      sabpaisaTxnId: params.sabpaisaTxnId,
      clientTxnId: params.clientTxnId,
      paidAmount: parseFloat(params.paidAmount || '0'),
      paymentMode: params.paymentMode,
      transDate: params.transDate,
      bankName: params.bankName,
      rawData: params
    };
  }
}

module.exports = new SabPaisaService();
```

---

## 7. Frontend Integration

### Option A: Form POST (Recommended)

```html
<!-- payment.html -->
<form id="sabpaisaForm" method="POST" action="">
  <input type="hidden" name="encData" id="encData" />
  <input type="hidden" name="clientCode" id="clientCode" />
</form>

<script>
async function initiatePayment(orderDetails) {
  // Call your backend to get encrypted data
  const response = await fetch('/api/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderDetails)
  });
  
  const data = await response.json();
  
  // Set form values and submit
  document.getElementById('encData').value = data.encData;
  document.getElementById('clientCode').value = data.clientCode;
  document.getElementById('sabpaisaForm').action = data.actionUrl;
  document.getElementById('sabpaisaForm').submit();
}
</script>
```

### Option B: React Component

```jsx
// SabPaisaCheckout.jsx
import { useEffect, useRef } from 'react';

export default function SabPaisaCheckout({ paymentData }) {
  const formRef = useRef(null);

  useEffect(() => {
    if (paymentData?.encData) {
      // Auto-submit the form
      formRef.current?.submit();
    }
  }, [paymentData]);

  if (!paymentData) return null;

  return (
    <form
      ref={formRef}
      method="POST"
      action={paymentData.actionUrl}
    >
      <input type="hidden" name="encData" value={paymentData.encData} />
      <input type="hidden" name="clientCode" value={paymentData.clientCode} />
      <button type="submit">Proceed to Payment</button>
    </form>
  );
}
```

---

## 8. Handle Callback/Webhook

### Express.js Route:

```javascript
const express = require('express');
const sabpaisaService = require('./sabpaisa-service');

const router = express.Router();

// Callback route (SabPaisa redirects here after payment)
router.post('/sabpaisa/callback', async (req, res) => {
  try {
    const { encResponse } = req.body;
    
    if (!encResponse) {
      return res.redirect('/payment-failed?error=no_response');
    }

    // Decrypt and process the response
    const result = sabpaisaService.processCallback(encResponse);
    
    console.log('SabPaisa callback:', result);

    if (result.success) {
      // Payment successful
      // 1. Update your database
      // 2. Send confirmation email
      // 3. Redirect to success page
      return res.redirect(`/payment-success?txnId=${result.clientTxnId}`);
    } else {
      // Payment failed
      return res.redirect(`/payment-failed?txnId=${result.clientTxnId}&status=${result.status}`);
    }
  } catch (error) {
    console.error('Callback error:', error);
    return res.redirect('/payment-failed?error=processing_error');
  }
});

module.exports = router;
```

---

## 9. Testing

### Test Credentials (Staging)
Use the staging URL and your test credentials provided by SabPaisa.

### Test Cases:
1. **Successful Payment** - Complete payment with test card
2. **Failed Payment** - Cancel payment or use invalid card
3. **Duplicate Transaction** - Try same `clientTxnId` twice (should fail)

### Generate Unique Transaction ID:

```javascript
function generateTxnId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TXN${timestamp}${random}`;
}
```

---

## 10. Troubleshooting

### Common Errors:

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid Client Code" | Wrong clientCode or encData | Verify clientCode matches |
| "Encryption error" | Wrong authKey/authIV format | Ensure BASE64 encoded |
| "Missed Mandatory parameter" | Missing required field | Check all parameters |
| "Duplicate Transaction ID" | Reused clientTxnId | Generate unique ID |

### Debug Checklist:
1. ✅ authKey and authIV are BASE64 encoded
2. ✅ All parameters in correct order
3. ✅ No extra spaces in parameters
4. ✅ clientTxnId is unique
5. ✅ Callback URL is accessible
6. ✅ Using correct staging/production URL

### Test Encryption:

```javascript
const { encrypt, decrypt } = require('./sabpaisa-encryption');

const testPlaintext = 'payerName=Test&amount=100';
const authKey = process.env.SABPAISA_AUTH_KEY;
const authIV = process.env.SABPAISA_AUTH_IV;

const encrypted = encrypt(testPlaintext, authKey, authIV);
console.log('Encrypted:', encrypted);

const decrypted = decrypt(encrypted, authKey, authIV);
console.log('Decrypted:', decrypted);
console.log('Match:', decrypted === testPlaintext);
```

---

## Quick Reference

### Payment Flow:
```
1. User clicks "Pay" → 
2. Your backend creates encrypted encData → 
3. Frontend submits form to SabPaisa → 
4. User completes payment on SabPaisa page → 
5. SabPaisa redirects to your callback URL with encResponse → 
6. Your backend decrypts and processes → 
7. Redirect user to success/failure page
```

### Status Codes:
| Code | Status |
|------|--------|
| 0000 | SUCCESS |
| 0002 | PENDING |
| 0100 | INITIATED |
| 0200 | ABORTED |
| 0300 | FAILED |

---

## Support

- SabPaisa Documentation: https://developer.sabpaisa.in/
- SabPaisa Support: Contact your account manager

---

*Last updated: January 2026*

