# Razorpay Integration Architecture

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (Frontend)                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    React Component Layer                        │   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │          RazorpayCheckout Component                   │    │   │
│  │  │  - Script loading                                      │    │   │
│  │  │  - Order creation                                      │    │   │
│  │  │  - Payment initialization                              │    │   │
│  │  │  - Signature verification                              │    │   │
│  │  │  - Success/error callbacks                             │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  │                              ↓                                  │   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │         Razorpay Checkout Modal (External)             │    │   │
│  │  │  - Payment form                                        │    │   │
│  │  │  - Card details input                                  │    │   │
│  │  │  - OTP/Authentication                                  │    │   │
│  │  │  - Success/error response                              │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                   ↓
                          (HTTP/REST API)
                                   ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                   SERVER LAYER (Backend - Node.js)                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       API Routes Layer                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │ POST /orders │  │POST /verify  │  │GET /status   │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│  │  │POST /refund  │  │POST /webhook │  │GET /config   │          │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Controller Layer (Handlers)                        │   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │  RazorpayController                                   │    │   │
│  │  │  - Request validation                                  │    │   │
│  │  │  - Auth verification                                   │    │   │
│  │  │  - Service invocation                                  │    │   │
│  │  │  - Response formatting                                 │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │               Service Layer (Business Logic)                    │   │
│  │  ┌────────────────────────────────────────────────────────┐    │   │
│  │  │  RazorpayService                                       │    │   │
│  │  │  - Order creation                                      │    │   │
│  │  │  - Payment verification                                │    │   │
│  │  │  - Signature validation (HMAC-SHA256)                  │    │   │
│  │  │  - Webhook event processing                            │    │   │
│  │  │  - Refund handling                                     │    │   │
│  │  │  - Status checking                                     │    │   │
│  │  └────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │         Razorpay SDK (Official Node.js Library)                │   │
│  │  - API client initialization                                   │   │
│  │  - Request/response handling                                   │   │
│  │  - Timeout management                                          │   │
│  │  - Error handling                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                   ↓
                    (HTTPS + API Authentication)
                                   ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                  EXTERNAL LAYER (Razorpay API)                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Razorpay Payment Gateway                           │   │
│  │  - Order API         (create, fetch, capture, refund)           │   │
│  │  - Payment API       (fetch, refund, authorize)                 │   │
│  │  - Webhook API       (event delivery, signature verification)   │   │
│  │                                                                  │   │
│  │  API Endpoint: https://api.razorpay.com (Production)            │   │
│  │                https://checkout.razorpay.com (Checkout)         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                   ↓
                   (Payment Processing & Webhooks)
                                   ↓
┌──────────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Database)                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Transaction Table (Prisma)                     │   │
│  │  - transactionId (unique)                                       │   │
│  │  - amount                                                       │   │
│  │  - status (PENDING, SUCCESS, FAILED, REFUNDED)                  │   │
│  │  - pgOrderId (Razorpay order ID)                                │   │
│  │  - pgResponse (raw payment details)                             │   │
│  │  - failureReason (if failed)                                    │   │
│  │  - userId (transaction owner)                                   │   │
│  │  - createdAt, updatedAt                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### 1. Order Creation Flow

```
User Initiates Payment
        ↓
[RazorpayCheckout Component]
        ↓
POST /api/razorpay/orders
        ↓
[Auth Middleware - Verify JWT]
        ↓
[RazorpayController.createOrder]
  ├─ Validate transaction exists
  ├─ Verify user owns transaction
  └─ Invoke RazorpayService.createOrder
        ↓
[RazorpayService]
  ├─ Prepare order data
  ├─ Call Razorpay SDK: orders.create()
  └─ Store order ID in database
        ↓
[Razorpay API]
  ├─ Validate API credentials
  ├─ Create order in system
  ├─ Generate unique order ID
  └─ Return order details
        ↓
Response: {razorpayOrderId, keyId, ...}
        ↓
Frontend receives order ID
```

### 2. Payment Verification Flow

```
Payment Completed in Razorpay Modal
        ↓
Frontend receives: {paymentId, orderId, signature}
        ↓
POST /api/razorpay/verify
        ↓
[RazorpayService.verifyPaymentSignature]
  ├─ Generate signature: HMAC-SHA256
  ├─ Compare with received signature
  └─ Return: valid/invalid
        ↓
If Invalid → Error Response
        ↓
If Valid → Fetch Payment Details
        ↓
[RazorpayService.getPaymentDetails]
  ├─ Call Razorpay SDK: payments.fetch()
  └─ Return: full payment details
        ↓
[Update Transaction]
  ├─ Set status = SUCCESS
  ├─ Store payment ID
  ├─ Store card details (last 4, network)
  └─ Update database
        ↓
Response: {success: true, transactionId, ...}
        ↓
Frontend shows success message
```

### 3. Webhook Flow

```
User completes payment in Razorpay
        ↓
Razorpay processes transaction
        ↓
Razorpay Event (e.g., payment.captured)
        ↓
POST /api/razorpay/webhook
(No auth required - signature verified)
        ↓
[RazorpayController.webhook]
  ├─ Extract signature from header
  └─ Invoke RazorpayService.verifyWebhookSignature
        ↓
[Signature Verification]
  ├─ Generate expected signature: HMAC-SHA256(secret, body)
  ├─ Compare with header signature
  └─ Return: valid/invalid
        ↓
If Invalid → Log & Discard
        ↓
If Valid → Process Event
        ↓
[RazorpayService.processWebhookEvent]
  ├─ Parse event type
  ├─ Extract payment details
  ├─ Extract transaction ID (from notes)
  └─ Call appropriate handler
        ↓
[Handler Functions]
  ├─ handlePaymentAuthorized()
  ├─ handlePaymentCaptured()
  ├─ handlePaymentFailed()
  └─ handleRefundCreated()
        ↓
[Update Transaction in Database]
  ├─ Set status based on event
  ├─ Store payment details
  └─ Log webhook event
        ↓
Response: {success: true, processed: true}
        ↓
Razorpay considers webhook delivered
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
└─────────────────────────────────────────────────────────────────┘

1. FRONTEND SECURITY
   ├─ JWT Authentication (Bearer token in headers)
   ├─ Token refresh mechanism
   ├─ Local storage encryption
   └─ HTTPS only communication

2. API SECURITY
   ├─ Auth Middleware (verify JWT)
   ├─ Role-based Access Control (RBAC)
   ├─ Input Validation (Zod schemas)
   ├─ Rate Limiting (express-rate-limit)
   └─ CORS configuration

3. PAYMENT SECURITY
   ├─ HMAC-SHA256 Signature Verification
   │  ├─ Used for payment verification
   │  └─ Used for webhook verification
   ├─ Secure credential storage (environment variables)
   ├─ No credentials in logs or responses
   └─ Transaction ownership verification

4. NETWORK SECURITY
   ├─ HTTPS/TLS encryption
   ├─ API key authentication (Razorpay)
   ├─ Webhook signature validation
   └─ CORS restrictions

5. DATA SECURITY
   ├─ Sensitive data encrypted at rest
   ├─ PCI compliance (card details handled by Razorpay)
   ├─ Secure database connections
   └─ Audit logging
```

---

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONFIGURATION MANAGEMENT                     │
└─────────────────────────────────────────────────────────────────┘

Environment Variables (.env)
        ↓
┌─────────────────────────────────────────┐
│ RAZORPAY_ENABLED                        │
│ RAZORPAY_KEY_ID                         │
│ RAZORPAY_KEY_SECRET                     │
│ RAZORPAY_WEBHOOK_SECRET                 │
│ RAZORPAY_CALLBACK_URL                   │
└─────────────────────────────────────────┘
        ↓
dotenv.config()
        ↓
config/index.ts
        ↓
┌─────────────────────────────────────────┐
│ config.razorpay = {                     │
│   enabled: boolean                      │
│   keyId: string                         │
│   keySecret: string                     │
│   webhookSecret: string                 │
│   callbackUrl: string                   │
│ }                                       │
└─────────────────────────────────────────┘
        ↓
RazorpayService Constructor
        ↓
new Razorpay({ key_id, key_secret })
        ↓
Service Ready for Use
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING CHAIN                         │
└─────────────────────────────────────────────────────────────────┘

Request
   ↓
Try Block
   ↓
├─ Service Call
│  ├─ Success → Response
│  └─ Error → Catch
│      ├─ Log error
│      └─ Return {success: false, error: message}
│
└─ Controller Catch Block
   ├─ next(error) → Express Error Handler
   └─ Middleware logs & formats error
       ├─ 400: Bad Request (validation)
       ├─ 401: Unauthorized (auth)
       ├─ 403: Forbidden (permission)
       ├─ 404: Not Found (resource)
       └─ 500: Internal Server Error
           └─ Generic message (no sensitive data)
```

---

## Deployment Architecture

```
Production Environment
────────────────────────────────────────────

┌──────────────────┐
│   Frontend       │
│  (Next.js)       │
│  Port: 5000      │
│  https://app     │
└────────┬─────────┘
         │
    HTTPS + JWT
         │
┌────────▼──────────┐          ┌─────────────────┐
│   Backend API     │◄────────►│  Razorpay API   │
│  (Node.js)        │  HTTPS   │  (External SaaS)│
│  Port: 4100       │◄────────►│  API Auth       │
│  https://api      │ Webhooks │  Signature Sec. │
└────────┬──────────┘          └─────────────────┘
         │
    Database
         │
┌────────▼──────────┐
│   PostgreSQL      │
│  (Production DB)  │
│  Encrypted conn   │
└───────────────────┘

Security Features:
- SSL/TLS certificates
- Environment variable secrets
- Database encryption
- API rate limiting
- Webhook IP whitelisting
- Monitoring & alerts
```

---

## Integration Points

```
WebsiteNew Platform Integration Points

┌────────────────────────────────────────────────────────────┐
│                  Existing Features                         │
│                                                            │
│  ├─ Transaction Management                                │
│  ├─ User Hierarchy & Roles                                │
│  ├─ Wallet System                                         │
│  ├─ Rate Management                                       │
│  ├─ KYC/Onboarding                                        │
│  └─ Ledger & Reporting                                    │
└────────────────────────────────────────────────────────────┘
                        ↓
           ┌────────────────────────┐
           │   Razorpay Integration │
           │                        │
           │  ├─ Payment Processing │
           │  ├─ Order Management   │
           │  ├─ Webhook Handling   │
           │  └─ Refund Processing  │
           └────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│              Database (Prisma + SQLite/Postgres)           │
│                                                            │
│  Stores:                                                   │
│  - Transaction records with payment details               │
│  - Payment IDs, order IDs                                 │
│  - Card information (tokenized)                           │
│  - Refund records                                         │
│  - Webhook event logs                                     │
└────────────────────────────────────────────────────────────┘
```

---

## Future Extensibility

```
Multiple Payment Gateway Architecture (Already in Place)

┌──────────────────────────────────────────────────────────┐
│                  Payment Gateway Service                 │
│                                                          │
│  ├─ RazorpayService    ✅ Implemented                     │
│  ├─ CashfreeService    (Template ready)                  │
│  ├─ PayUService        (Can be added)                    │
│  └─ PaytmService       (Can be added)                    │
└──────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────┐
│  Gateway Router/Selector                                 │
│  (Route to appropriate gateway based on configuration)   │
└──────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────┐
│  Unified Payment API                                     │
│  (Same endpoints, different backends)                    │
└──────────────────────────────────────────────────────────┘

Benefits:
- Easy to add new gateways
- Simplified switching between providers
- Consistent API across gateways
- Rate comparison and selection
```

---

## Performance Considerations

```
Optimization Strategies

1. REQUEST LEVEL
   ├─ Connection pooling (Razorpay SDK)
   ├─ Request timeout (30 seconds)
   └─ Retry logic with exponential backoff

2. DATABASE LEVEL
   ├─ Indexed lookups (transactionId, userId)
   ├─ Batch updates for webhook processing
   └─ Archive old records

3. CACHING LEVEL
   ├─ Cache payment status (5 min TTL)
   ├─ Cache gateway config (30 min TTL)
   └─ Client-side token caching

4. MONITORING
   ├─ Response time tracking
   ├─ Error rate monitoring
   ├─ Webhook latency tracking
   └─ Database query optimization

Metrics to Track:
- Order creation time: < 1s
- Payment verification time: < 2s
- Webhook processing time: < 5s
- API error rate: < 0.1%
- Webhook success rate: > 99%
```

---

This comprehensive architecture ensures:
✅ Security at every layer
✅ Scalability for future growth
✅ Extensibility for multiple gateways
✅ Reliability with proper error handling
✅ Maintainability with clean separation of concerns
