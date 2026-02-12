# Base Rate Configuration Guide

## Overview
In the new channel-based rate system, **base rates are set per TransactionChannel**, not per PaymentGateway.

## Where Base Rates Are Set

### 1. TransactionChannel Base Cost
Each channel has a `baseCost` field that represents the minimum cost for that payment method.

**Location**: `backend/prisma/seed-transaction-channels.ts`

**Example channels with base costs**:
```typescript
// UPI
{ code: 'upi', name: 'UPI', baseCost: 0.015 } // 1.5%

// Credit Cards
{ code: 'credit_visa_normal', name: 'VISA Normal', baseCost: 0.028 } // 2.8%
{ code: 'credit_visa_corporate', name: 'VISA Corporate', baseCost: 0.03 } // 3.0%
{ code: 'credit_visa_premium', name: 'VISA Premium', baseCost: 0.032 } // 3.2%
{ code: 'credit_master_normal', name: 'MasterCard Normal', baseCost: 0.028 } // 2.8%
{ code: 'credit_master_corporate', name: 'MasterCard Corporate', baseCost: 0.03 } // 3.0%

// Debit Card
{ code: 'debitcard', name: 'Debit Card', baseCost: 0.022 } // 2.2%

// Net Banking
{ code: 'netbanking', name: 'Net Banking', baseCost: 0.02 } // 2.0%
```

### 2. Schema Payin Rates (Per Channel)
Schemas define rates per channel, which must be >= channel base cost.

**Model**: `SchemaPayinRate`
**Fields**:
- `schemaId` - Which pricing schema (Gold, Platinum, etc.)
- `channelId` - Which payment channel
- `payinRate` - The rate charged (must be >= channel.baseCost)

### 3. User Payin Rates (Per Channel)
Users can have custom rates per channel (if assigned by parent).

**Model**: `UserPayinRate`
**Fields**:
- `userId` - The user
- `channelId` - Which payment channel
- `payinRate` - Custom rate for this user

## Rate Hierarchy

```
1. Check UserPayinRate (specific user + channel)
   ↓ If not found
2. Check SchemaPayinRate (user's schema + channel)
   ↓ If not found
3. Use Channel Base Cost (channel.baseCost)
```

## How to Update Base Rates

### Production Database

**Step 1**: Update the channel base cost
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18
cd /var/www/payment-gateway/backend
sqlite3 prisma/prod.db

-- Example: Update VISA Normal base cost to 2.5%
UPDATE TransactionChannel 
SET baseCost = 0.025 
WHERE code = 'credit_visa_normal';
```

**Step 2**: Update affected schema rates (optional)
```sql
-- View current schema rates for a channel
SELECT s.name, sr.payinRate 
FROM SchemaPayinRate sr
JOIN Schema s ON s.id = sr.schemaId
WHERE sr.channelId = (SELECT id FROM TransactionChannel WHERE code = 'credit_visa_normal');

-- Update if needed (must be >= new base cost)
UPDATE SchemaPayinRate 
SET payinRate = 0.03  -- 3%
WHERE channelId = (SELECT id FROM TransactionChannel WHERE code = 'credit_visa_normal')
AND schemaId = (SELECT id FROM Schema WHERE name = 'Platinum');
```

### Seed Files (For Fresh Deployments)

**File**: `backend/prisma/seed-transaction-channels.ts`

Update the `baseCost` values in the channel definitions:

```typescript
// Line ~105-120 in seed-transaction-channels.ts
{
  code: `${pg.code.toLowerCase()}_credit_visa_normal`,
  name: 'VISA Normal',
  pgId: pg.id,
  transactionType: 'PAYIN',
  category: 'CREDITCARD',
  baseCost: 0.028, // ← UPDATE THIS
  cardNetwork: 'VISA',
  cardType: 'NORMAL',
  // ...
}
```

## Current Base Costs (Production)

| Channel | Base Cost | Category |
|---------|-----------|----------|
| UPI | 1.5% | UPI |
| Net Banking | 2.0% | NETBANKING |
| Debit Card | 2.2% | DEBITCARD |
| Digital Wallet | 1.8% | WALLET |
| VISA Normal | 2.8% | CREDITCARD |
| VISA Corporate | 3.0% | CREDITCARD |
| VISA Premium | 3.2% | CREDITCARD |
| MasterCard Normal | 2.8% | CREDITCARD |
| MasterCard Corporate | 3.0% | CREDITCARD |
| MasterCard Premium | 3.2% | CREDITCARD |
| RuPay | 2.5% | CREDITCARD |
| American Express | 3.5% | CREDITCARD |
| Diners Club | 3.5% | CREDITCARD |

## Payment Gateway List (Production)

Currently active payment gateways:

| Name | Code | Supported Types |
|------|------|-----------------|
| Razorpay | RAZORPAY | PAYIN, PAYOUT |
| PayU | PAYU | PAYIN |
| Cashfree | CASHFREE | PAYIN, PAYOUT |
| Paytm | PAYTM | PAYIN |
| **Sabpaisa** | **SABPAISA** | **PAYIN** |

**Note**: All 5 PGs are now in production database. Each PG can have 19+ channels seeded via `seed-transaction-channels.ts`.

## Validation Rules

### Schema Payin Rate Assignment
```typescript
// File: channelAdmin.controller.ts line 453
if (payinRate < (channel.baseCost - 0.0001)) {
  throw new AppError(
    `Rate cannot be lower than channel base cost`,
    400
  );
}
```

**Rule**: Schema rate must be >= channel base cost (with 0.01% tolerance for floating point).

### User Payin Rate Assignment
Same rule applies - user custom rates must be >= channel base cost.

## Common Issues

### Issue: "Rate (2.80%) cannot be lower than channel base cost (2.80%)"
**Cause**: Floating point precision issues when comparing decimals.
**Fixed**: Added epsilon tolerance (0.0001 = 0.01%) for comparison.

### Issue: Sabpaisa PG missing
**Cause**: Not seeded in production database.
**Fixed**: Run `npx ts-node prisma/seed-pgs.ts` on production.

### Issue: Channels not showing for new PG
**Cause**: Channels not seeded for that PG.
**Solution**: Run `npx ts-node prisma/seed-transaction-channels.ts` on production.

## Quick Commands

```bash
# Check all PGs
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   sqlite3 prisma/prod.db 'SELECT name, code, isActive FROM PaymentGateway;'"

# Check channel count per PG
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   sqlite3 prisma/prod.db 'SELECT pg.name, COUNT(tc.id) as channels FROM PaymentGateway pg LEFT JOIN TransactionChannel tc ON tc.pgId = pg.id GROUP BY pg.id;'"

# Add Sabpaisa
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   npx ts-node prisma/seed-pgs.ts"

# Seed channels for all PGs (if missing)
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   npx ts-node prisma/seed-transaction-channels.ts"
```

## Migration Notes

### Old System (Removed)
- ❌ `PaymentGateway.baseRate` field (removed)
- ❌ `CardType` model (replaced by TransactionChannel)
- ❌ Single base rate per PG

### New System (Current)
- ✅ `TransactionChannel.baseCost` (per channel)
- ✅ 19+ channels per PG (UPI, Cards, NetBanking, etc.)
- ✅ Different base costs per payment method
- ✅ Schema rates per channel
- ✅ User rates per channel
