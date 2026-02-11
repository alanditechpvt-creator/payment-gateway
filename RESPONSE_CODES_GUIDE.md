# Payment Gateway Response Codes Management

## Overview
The Response Codes Management feature allows admins to configure how payment method strings from payment gateway API responses are matched to transaction channels. This is crucial for correctly identifying payment methods and applying the appropriate rates.

## Accessing the Feature

1. **Navigate to Admin Dashboard** → **Schemas** section
2. Click **"Configure Rates"** on any schema
3. Select a Payment Gateway
4. Click **"PAYIN Channels"** to configure rates
5. Click the **"Response Codes"** button (purple button with gear icon)

## How It Works

### Matching Algorithm

When a payment is completed, the payment gateway (e.g., Razorpay, Sabpaisa) returns a payment method string in their webhook/response:

```json
{
  "payment_method": "credit_card_visa",
  "card_network": "Visa",
  // ... other fields
}
```

The system uses the `pgResponseCodes` array configured for each channel to match this string:

1. **Converts to lowercase**: Both the PG response and configured codes are normalized
2. **Substring matching**: Checks if the PG response *contains* any configured code
3. **First match wins**: Returns the first channel that matches
4. **Fallback to default**: If no match is found, uses the default channel (marked as "Default Fallback")

### Example Configuration

**Visa Channel Response Codes:**
```
visa, VISA, Visa, credit_card_visa, visa_normal, visa_debit, visa_credit
```

**Why multiple variations?**
- Different PGs use different formats
- Razorpay might return: `"credit_card_visa"`
- Sabpaisa might return: `"VISA"`
- Another PG might return: `"visa_normal"`

Having all variations ensures the correct channel is matched regardless of the PG's format.

## Configuration Guide

### For Each Channel:

1. **Click the Edit button** (pencil icon) next to the channel
2. **Enter response codes** separated by commas:
   ```
   visa, VISA, Visa, credit_card_visa, visa_normal
   ```
3. **Click "Save"** to update

### Best Practices:

✅ **Include multiple case variations**
- Example: `amex, AMEX, Amex, american_express, americanexpress, amx`

✅ **Add PG-specific variations**
- Check actual responses from each PG's documentation
- Test with real transactions to capture edge cases

✅ **Use descriptive codes**
- Include both short and long forms: `upi, unified_payments, bhim`

✅ **Set a Default Fallback**
- One channel per PG should be marked as "Default Fallback"
- This catches any unmatched payment methods
- Usually set this to a generic channel with moderate rates

✅ **Monitor unmatched transactions**
- Check backend logs for: `Channel detected: payin_default`
- This indicates a payment method wasn't matched
- Add the new code to the appropriate channel

### Example Configurations

#### UPI Channel
```
upi, UPI, unified_payments, bhim, BHIM, google_pay, phonepe, paytm_upi
```

#### Visa Card
```
visa, VISA, Visa, credit_card_visa, visa_normal, visa_debit, visa_credit, visa_card
```

#### Mastercard
```
mastercard, MASTERCARD, master, MASTER, mc, MC, credit_card_mastercard
```

#### RuPay
```
rupay, RUPAY, RuPay, rupay_card, RUPAY_CARD
```

#### American Express
```
amex, AMEX, Amex, american_express, americanexpress, amx, AMX
```

## Handling Edge Cases

### Case 1: PG Returns Unexpected Format

**Problem:** Razorpay suddenly returns `"amx"` instead of `"amex"`

**Solution:**
1. Go to Response Codes Management
2. Edit American Express channel
3. Add `amx` to the list: `amex, AMEX, Amex, american_express, americanexpress, amx`
4. Save changes

### Case 2: New Payment Method

**Problem:** PG adds support for a new wallet (e.g., "GPay UPI")

**Solution:**
1. Check if it should map to an existing channel (UPI) or needs a new channel
2. If existing: Add `gpay_upi, gpay` to UPI channel codes
3. If new: Create a new channel via Channels Management (if needed)

### Case 3: Multiple Channels Match

**Problem:** Both "Card" and "Visa" channels have `credit` in their codes

**Solution:**
- Be specific with codes
- Remove generic codes from channels that should be specific
- Use PG-specific identifiers: `visa`, `visa_credit` instead of just `credit`

## Technical Details

### Database Schema
```prisma
model TransactionChannel {
  id              String   @id @default(uuid())
  pgId            String
  code            String   // e.g., "visa_normal"
  name            String   // e.g., "Visa Card"
  pgResponseCodes String?  // JSON array: ["visa", "VISA", "credit_card_visa"]
  isDefault       Boolean  @default(false)
  // ... other fields
}
```

### API Endpoint
```http
PATCH /api/admin/channels/:channelId/response-codes
Authorization: Bearer <token>
Content-Type: application/json

{
  "responseCodes": ["visa", "VISA", "credit_card_visa"]
}
```

### Backend Logic
Location: `backend/src/services/channelRate.service.ts`

```typescript
async detectChannel(pgId, rawPaymentMethod, transactionType) {
  const lowerPaymentMethod = rawPaymentMethod.toLowerCase().trim();
  
  for (const channel of channels) {
    const responseCodes = JSON.parse(channel.pgResponseCodes);
    const matched = responseCodes.some(code => 
      lowerPaymentMethod.includes(code.toLowerCase())
    );
    
    if (matched) {
      return channel; // ✅ Match found
    }
  }
  
  // ❌ No match - use default
  return await this.getDefaultChannel(pgId, transactionType);
}
```

## Troubleshooting

### Issue: Transactions using wrong rate

**Diagnosis:**
1. Check transaction details for `channelId` and `channelCode`
2. Check backend logs for channel detection: `Channel detected: <code>`
3. Verify the PG response in webhook logs

**Fix:**
1. Identify the actual string sent by PG
2. Add it to the correct channel's response codes
3. Future transactions will use correct channel

### Issue: All transactions using default channel

**Diagnosis:**
- No channels have matching response codes
- Response codes don't match PG's format

**Fix:**
1. Review PG's webhook documentation
2. Check actual webhook payloads (backend logs)
3. Update response codes to match PG's format

## Monitoring

### Check Channel Usage
```sql
-- See which channels are being used
SELECT 
  tc.name,
  tc.code,
  COUNT(t.id) as transaction_count
FROM TransactionChannel tc
LEFT JOIN Transaction t ON t.channelId = tc.id
WHERE tc.transactionType = 'PAYIN'
GROUP BY tc.id
ORDER BY transaction_count DESC;
```

### Identify Unmatched Transactions
Check backend logs for:
```
[info]: Channel detected: payin_default for payment method: new_payment_type
```

This tells you:
- A transaction used the default channel
- The actual payment method string was `new_payment_type`
- You should add `new_payment_type` to the appropriate channel's codes

## Benefits

✅ **Accurate Rate Application**: Ensures correct rates are charged based on actual payment method  
✅ **PG Flexibility**: Works with any payment gateway's response format  
✅ **Easy Maintenance**: Update mappings without code changes  
✅ **Fallback Safety**: Default channel prevents transaction failures  
✅ **Real-time Updates**: Changes apply immediately to new transactions  

## Support

For issues or questions:
1. Check backend logs for actual PG responses
2. Review PG documentation for response format
3. Test with small transactions to verify matching
4. Monitor default channel usage to catch unmatched codes
