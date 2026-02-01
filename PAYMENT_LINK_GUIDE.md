# Payment Link Feature

## Overview
The Payment Link feature allows users to generate shareable payment links for PAYIN transactions. This is useful when the person initiating the transaction doesn't have access to the customer's payment card details due to confidentiality reasons.

## How It Works

### 1. Generate Payment Link
- Navigate to **Dashboard → New Transaction**
- Select **PAYIN** as transaction type
- Fill in transaction details (Payment Gateway, Amount, Customer Info)
- Click **"Copy Link"** button (next to "Initiate Payin" button)
- A shareable payment link will be automatically copied to your clipboard

### 2. Share the Link
- Share the copied link with the customer via:
  - Email
  - WhatsApp
  - SMS
  - Any messaging platform

### 3. Customer Completes Payment
- Customer opens the payment link
- Transaction details are displayed (Amount, Transaction ID)
- Payment gateway checkout interface loads automatically
- Customer enters their payment card details
- Payment is processed securely

### 4. Monitor Status
- Transaction appears in your transaction list immediately
- Status updates automatically when payment completes
- You can manually refresh status if needed

## Payment Link Format
```
https://your-domain.com/payment/{transactionId}
```

Example:
```
http://localhost:5000/payment/TXN176984278592210RY7CRE5
```

## Supported Payment Gateways
The payment link works with all configured payment gateways:
- ✅ SabPaisa (Embedded checkout)
- ✅ Razorpay (Embedded checkout)
- ✅ Cashfree (Embedded checkout)
- ✅ PayU (Redirect to PG)
- ✅ Runpaisa (Redirect to PG)

## Security Features

### 1. Public Access
- Payment links are accessible without login
- Only essential transaction data is exposed
- Payment processing requires gateway authentication

### 2. Transaction Status Protection
- Completed transactions cannot be paid again
- Failed transactions are clearly marked
- Expired transactions are handled gracefully

### 3. Data Privacy
- Only public transaction fields are exposed:
  - Transaction ID
  - Amount
  - Customer Name (if provided)
  - Payment Gateway
  - Status
- Sensitive data (user details, internal IDs) is NOT exposed

## Transaction Statuses

### PENDING
- Payment link is active
- Customer can proceed with payment
- Payment gateway checkout is displayed

### SUCCESS
- Payment completed successfully
- Link shows success message
- No further action possible

### FAILED
- Payment failed or was cancelled
- Link shows failure message
- Transaction cannot be retried (create new transaction)

## UI Features

### Success Screen
After generating a link, you'll see:
- ✅ Large, highlighted payment link section
- 📋 One-click copy button
- 📱 Responsive design (mobile-friendly)
- 🔗 Clear instructions for sharing

### Payment Page
Customers see:
- 💳 Clean, professional payment interface
- 🔒 Security indicators
- 💰 Clear amount display
- ℹ️ Transaction details
- 🔄 Status refresh option

## API Endpoints

### Backend
```typescript
GET /api/transactions/public/:transactionId
```
- Public endpoint (no authentication required)
- Returns limited transaction data
- Used by payment link page

### Frontend
```typescript
transactionApi.getTransactionByIdPublic(transactionId)
```

## Example Usage

### 1. Admin Creates Payment Link
```
1. Go to New Transaction page
2. Select "PAYIN"
3. Choose "SabPaisa" gateway
4. Enter amount: ₹100
5. Enter customer details (optional)
6. Click "Copy Link" button
7. ✅ Link copied: http://localhost:5000/payment/TXN123...
```

### 2. Share with Customer
```
Message to customer:
"Please complete your payment of ₹100 using this secure link:
http://localhost:5000/payment/TXN123...

The link will take you directly to our secure payment page."
```

### 3. Customer Completes Payment
```
1. Customer clicks link
2. Sees payment page with amount ₹100
3. SabPaisa checkout loads automatically
4. Enters card details
5. Confirms payment
6. Redirected to success page
```

### 4. Admin Sees Updated Status
```
1. Transaction list automatically updates
2. Status changes from PENDING → SUCCESS
3. Amount credited to wallet
4. SMS/Email confirmation sent (if configured)
```

## Benefits

### For Administrators
- ✅ No need to handle customer card details
- ✅ Maintain customer privacy and security
- ✅ Reduce PCI compliance complexity
- ✅ Easy to share via any channel
- ✅ Track all transactions in one place

### For Customers
- ✅ Secure payment processing
- ✅ No login required
- ✅ Direct payment gateway integration
- ✅ Clear transaction details
- ✅ Professional payment experience

## Technical Implementation

### Components
- `frontend/src/app/dashboard/transactions/new/page.tsx` - Link generation
- `frontend/src/app/payment/[transactionId]/page.tsx` - Payment page
- `backend/src/controllers/transaction.controller.ts` - Public API endpoint
- `backend/src/routes/transaction.routes.ts` - Route configuration

### State Management
- `generatedPaymentLink` - Stores the shareable link
- `isGeneratingLink` - Loading state for link generation
- Transaction state managed by React Query

### Flow
```
[Create Transaction] → [Generate Link] → [Copy to Clipboard]
                                              ↓
                                    [Share with Customer]
                                              ↓
                                    [Customer Opens Link]
                                              ↓
                            [Public API Fetches Transaction]
                                              ↓
                                [Payment Gateway Checkout]
                                              ↓
                                    [Payment Processing]
                                              ↓
                              [Status Update via Callback/Webhook]
                                              ↓
                                  [Admin Sees Updated Status]
```

## Testing

### Test Scenarios
1. **Generate Link** - Verify link is created and copied
2. **Open Link** - Verify payment page loads correctly
3. **Complete Payment** - Verify payment processes successfully
4. **Check Status** - Verify status updates in transaction list
5. **Expired Link** - Test with completed/failed transactions

### Test Commands
```powershell
# Start backend
cd backend
npm run dev

# Start frontend (separate terminal)
cd frontend
npm run dev

# Create test transaction
1. Go to http://localhost:5000/dashboard/transactions/new
2. Fill in details
3. Click "Copy Link"
4. Open link in incognito/private window
5. Complete payment
```

## Troubleshooting

### Link Not Working
- Verify backend is running
- Check transaction exists in database
- Ensure public endpoint is accessible

### Payment Not Processing
- Check payment gateway credentials
- Verify webhook/callback URLs
- Check backend logs for errors

### Status Not Updating
- Refresh the transaction list
- Check if webhooks are configured
- Use "Check Status" button for offline mode

## Future Enhancements
- [ ] Link expiration time
- [ ] Link usage tracking (how many times opened)
- [ ] QR code generation for payment links
- [ ] WhatsApp/Email direct sharing
- [ ] Custom link aliases
- [ ] Payment reminders
- [ ] Multi-language support
