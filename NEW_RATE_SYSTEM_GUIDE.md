# New Rate System Implementation Guide

## 📋 Overview

This guide covers the complete implementation of the new rate system with:
- **Transaction Channels** (replaces CardType)
- **Slab-based Payout** (flat charges, not percentage)
- **Schema-level Payin rates** (per channel)
- **User-level rate overrides** (by MD/Admin)
- **Default rates** for unknown channels

---

## 🎯 Key Changes

### 1. **PAYIN System**
- ✅ Rates defined per **Transaction Channel**
- ✅ Channels: UPI, Net Banking, Debit Card, Wallet, Credit Cards (VISA, Master, etc.)
- ✅ Admin can add custom channels
- ✅ **Default channel** with higher rate for unknown payment methods (3.5%)

### 2. **PAYOUT System**
- ✅ Only **IMPS** and **NEFT** channels
- ✅ **Slab-based flat charges** (₹10, ₹12, ₹15, etc.)
- ✅ One PG per schema for payout
- ✅ **Default rate** for unknown payout methods (use highest slab)

### 3. **Rate Assignment**
- ✅ **Admin**: Sets schema-level rates only
- ✅ **MD**: Can assign individual user-level rates
- ✅ Fresh start (no migration of old data)

---

## 📦 Files Created

### Prisma Schema
- `backend/prisma/schema-new.prisma` - New database schema

### Seed Scripts
- `backend/prisma/seed-transaction-channels.ts` - Seeds standard channels
- `backend/prisma/seed-schema-rates.ts` - Seeds schema rates and payout config

### Migration Script
- `backend/prisma/migrate-to-new-rate-system.js` - Backup & migrate script

---

## 🚀 Migration Steps

### Step 1: Backup Current System

```bash
cd backend/prisma

# Manual backup (recommended)
cp prod.db backups/prod-manual-backup.db
cp schema.prisma backups/schema-manual-backup.prisma
```

### Step 2: Run Migration Script

```bash
# This will:
# 1. Backup database and schema
# 2. Replace schema with new one
# 3. Reset database
# 4. Seed payment gateways
# 5. Seed transaction channels
# 6. Seed schemas
# 7. Seed schema rates

node migrate-to-new-rate-system.js
```

When prompted, type `yes` to confirm.

### Step 3: Verify Migration

```bash
# Check if tables exist
npx prisma studio

# Look for:
# - TransactionChannel (should have ~20 rows per PG)
# - SchemaPayinRate (should have rates for all channels)
# - SchemaPayoutConfig (one per schema)
# - PayoutSlab (4 slabs per schema)
```

---

## 📊 Standard Transaction Channels

### PAYIN Channels (Auto-seeded)

| Code | Name | Category | Base Cost |
|------|------|----------|-----------|
| `upi` | UPI | UPI | 1.5% |
| `netbanking` | Net Banking | NETBANKING | 2.0% |
| `debitcard` | Debit Card | DEBITCARD | 2.2% |
| `wallet` | Digital Wallet | WALLET | 1.8% |
| `credit_visa_normal` | VISA Normal | CREDITCARD | 2.8% |
| `credit_visa_corporate` | VISA Corporate | CREDITCARD | 3.0% |
| `credit_visa_premium` | VISA Premium | CREDITCARD | 3.2% |
| `credit_master_normal` | MasterCard Normal | CREDITCARD | 2.8% |
| `credit_master_corporate` | MasterCard Corporate | CREDITCARD | 3.0% |
| `credit_master_premium` | MasterCard Premium | CREDITCARD | 3.2% |
| `credit_rupay` | RuPay Credit | CREDITCARD | 2.5% |
| `credit_amex` | American Express | CREDITCARD | 3.5% |
| `credit_diners` | Diners Club | CREDITCARD | 3.5% |
| `credit_discover` | Discover | CREDITCARD | 3.5% |
| `credit_jcb` | JCB | CREDITCARD | 3.5% |
| `payin_default` | Other Payment | OTHER | **3.5%** (fallback) |

### PAYOUT Channels (Auto-seeded)

| Code | Name | Category | Base Cost |
|------|------|----------|-----------|
| `imps` | IMPS | IMPS | Slab-based |
| `neft` | NEFT | NETBANKING | Slab-based |
| `payout_default` | Other Payout | OTHER | Highest slab |

---

## 💰 Default Payout Slabs

### Platinum Schema
| Amount Range | Flat Charge |
|--------------|-------------|
| ₹1 - ₹50,000 | ₹10 |
| ₹50,001 - ₹100,000 | ₹12 |
| ₹100,001 - ₹200,000 | ₹15 |
| ₹200,001+ | ₹20 |

### Gold Schema
| Amount Range | Flat Charge |
|--------------|-------------|
| ₹1 - ₹50,000 | ₹12 |
| ₹50,001 - ₹100,000 | ₹15 |
| ₹100,001 - ₹200,000 | ₹20 |
| ₹200,001+ | ₹25 |

### Silver Schema
| Amount Range | Flat Charge |
|--------------|-------------|
| ₹1 - ₹50,000 | ₹15 |
| ₹50,001 - ₹100,000 | ₹18 |
| ₹100,001 - ₹200,000 | ₹22 |
| ₹200,001+ | ₹28 |

---

## 🔧 Service Updates Required

### 1. Rate Service (`backend/src/services/rate.service.ts`)

**New Methods Needed:**

```typescript
// Get available channels for a user (based on schema + PG assignment)
async getAvailableChannels(userId: string, transactionType: 'PAYIN' | 'PAYOUT'): Promise<TransactionChannel[]>

// Get payin rate for user + channel
async getPayinRate(userId: string, channelId: string): Promise<number>

// Get payout charge for user + amount
async getPayoutCharge(userId: string, amount: number): Promise<number>

// Assign payin rate to user (by parent/MD)
async assignUserPayinRate(parentId: string, userId: string, channelId: string, rate: number): Promise<UserPayinRate>

// Assign payout slabs to user (by parent/MD)
async assignUserPayoutRate(parentId: string, userId: string, slabs: PayoutSlabInput[]): Promise<UserPayoutRate>
```

### 2. Transaction Service (`backend/src/services/transaction.service.ts`)

**New Methods Needed:**

```typescript
// Detect channel from PG response
async detectChannel(pgId: string, rawPaymentMethod: string, transactionType: string): Promise<TransactionChannel>

// Calculate charges based on channel
async calculateCharges(userId: string, channelId: string, amount: number, type: 'PAYIN' | 'PAYOUT'): Promise<{
  pgCharges: number;
  platformCommission: number;
  netAmount: number;
}>
```

### 3. Admin Service (`backend/src/services/admin.service.ts`)

**New Methods Needed:**

```typescript
// Manage transaction channels
async createTransactionChannel(data: CreateChannelInput): Promise<TransactionChannel>
async updateTransactionChannel(channelId: string, data: UpdateChannelInput): Promise<TransactionChannel>
async deleteTransactionChannel(channelId: string): Promise<void>

// Manage schema payin rates
async setSchemaPayinRate(schemaId: string, channelId: string, rate: number): Promise<SchemaPayinRate>

// Manage schema payout config
async setSchemaPayoutConfig(schemaId: string, pgId: string, slabs: PayoutSlabInput[]): Promise<SchemaPayoutConfig>
```

---

## 🎨 Admin UI Updates Required

### 1. Transaction Channels Page
**Path:** `/admin/channels`

**Features:**
- List all channels per PG
- Add new custom channel
- Edit channel (name, rates, response codes)
- Activate/deactivate channel

### 2. Schema Configuration Page
**Path:** `/admin/schemas/:id/rates`

**Features:**
- **Payin Tab:**
  - List all channels with current schema rates
  - Edit rate per channel
  - Enable/disable channel for schema
  
- **Payout Tab:**
  - Select payout PG
  - Configure slab-based charges
  - Add/edit/delete slabs

### 3. User Rate Assignment Page
**Path:** `/admin/users/:id/rates` (for MD role)

**Features:**
- **Payin Rates:**
  - List available channels
  - Assign custom rate per channel
  - Must be >= schema rate
  
- **Payout Rates:**
  - Configure custom payout slabs
  - Must be >= schema slabs

---

## 🧪 Testing Checklist

### Payin Flow
- [ ] Create test payin transaction with UPI
- [ ] Verify correct channel detected from PG response
- [ ] Verify correct rate applied (schema or user-level)
- [ ] Test with unknown payment method → should use default channel (3.5%)
- [ ] Test all credit card types (VISA, Master, Amex, etc.)

### Payout Flow
- [ ] Create test payout with IMPS
- [ ] Verify correct slab-based charge applied
- [ ] Test multiple amount ranges (< 50K, 50K-100K, etc.)
- [ ] Test with unknown payout method → should use highest slab

### Rate Assignment
- [ ] Admin sets schema payin rates
- [ ] MD assigns user payin rates (must be >= schema rate)
- [ ] Admin sets schema payout slabs
- [ ] MD assigns user payout slabs (must be >= schema slabs)
- [ ] Verify rate hierarchy validation

### Channel Management
- [ ] Admin creates custom transaction channel
- [ ] Custom channel appears in rate assignment
- [ ] Test PG response matching with custom codes
- [ ] Disable channel → should not be available for transactions

---

## 🔐 Permissions Required

### Admin
- Can manage transaction channels (create, edit, delete)
- Can set schema-level rates (payin & payout)
- Can view all channels and rates

### Master Distributor (MD)
- Can assign user-level payin rates to children
- Can assign user-level payout slabs to children
- Cannot modify schema-level rates
- Cannot create/edit channels

### Other Roles
- View only (own rates)
- Cannot assign rates

---

## 📝 API Endpoints to Create

### Transaction Channels
```
GET    /api/admin/transaction-channels                    # List all channels
POST   /api/admin/transaction-channels                    # Create channel
GET    /api/admin/transaction-channels/:id                # Get channel
PUT    /api/admin/transaction-channels/:id                # Update channel
DELETE /api/admin/transaction-channels/:id                # Delete channel
```

### Schema Rates
```
GET    /api/admin/schemas/:schemaId/payin-rates           # Get schema payin rates
POST   /api/admin/schemas/:schemaId/payin-rates           # Set payin rate
PUT    /api/admin/schemas/:schemaId/payin-rates/:channelId # Update payin rate

GET    /api/admin/schemas/:schemaId/payout-config         # Get payout config
POST   /api/admin/schemas/:schemaId/payout-config         # Set payout config
```

### User Rates
```
GET    /api/users/:userId/payin-rates                     # Get user payin rates
POST   /api/users/:userId/payin-rates                     # Assign payin rate
DELETE /api/users/:userId/payin-rates/:channelId          # Remove payin rate

GET    /api/users/:userId/payout-rate                     # Get user payout rate
POST   /api/users/:userId/payout-rate                     # Assign payout rate
DELETE /api/users/:userId/payout-rate                     # Remove payout rate
```

---

## 🐛 Troubleshooting

### Issue: Migration fails with "Table already exists"
**Solution:** Drop all tables first:
```bash
npx prisma migrate reset
node migrate-to-new-rate-system.js
```

### Issue: Channel not detected from PG response
**Solution:** Add PG response code to channel:
```sql
UPDATE TransactionChannel 
SET pgResponseCodes = '["visa", "VISA", "Visa Card", "your_pg_code"]'
WHERE code = 'credit_visa_normal';
```

### Issue: Default rate not applied
**Solution:** Verify default channel exists:
```sql
SELECT * FROM TransactionChannel WHERE isDefault = 1;
```

### Issue: User rate less than schema rate
**Solution:** Validate in service:
```typescript
if (userRate < schemaRate) {
  throw new Error('User rate must be >= schema rate');
}
```

---

## 📚 Additional Resources

- [RATE_SYSTEM_REDESIGN.md](./RATE_SYSTEM_REDESIGN.md) - Complete proposal
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Transaction Flow Diagram](#) - TODO: Create diagram

---

## ✅ Post-Migration Tasks

1. [ ] Update `.env` with new environment variables (if any)
2. [ ] Update frontend rate display components
3. [ ] Update transaction display to show channel name
4. [ ] Create admin documentation for rate management
5. [ ] Train support team on new rate system
6. [ ] Monitor first 100 transactions for accuracy
7. [ ] Set up alerts for unknown channels
8. [ ] Create report for channel usage analytics

---

## 🆘 Support

For issues or questions:
1. Check [Troubleshooting](#-troubleshooting) section
2. Review error logs in `backend/logs/`
3. Check Prisma Studio for data consistency
4. Contact development team

---

**Last Updated:** February 8, 2026
**Version:** 1.0.0
