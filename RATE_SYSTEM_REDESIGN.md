# Rate System Redesign - Complete Proposal

## ✅ APPROVED IMPLEMENTATION

**Decisions Made:**
1. ✅ Payout: Only **IMPS** and **NEFT** channels
2. ✅ Unknown channels: **Default rate** to avoid losses (3.5% payin, highest slab payout)
3. ✅ Schema rates: **Only admin** can change
4. ✅ User rates: **MD can assign** at individual user level
5. ✅ Payout: **Only slab-based**, no percentage
6. ✅ Migration: **Fresh start**, no backwards compatibility needed

---

## Current Issues
1. Complex separate configurations for PG rates and card type rates
2. Multiple rate definitions causing confusion
3. No slab-based payout system
4. Admin cannot easily define new transaction types

## New System Architecture

### 1. PAYOUT System (Slab-Based)

**Rules:**
- One PG per schema for payout (admin decides)
- Fixed slab-based flat charges (not percentage)
- Simple, predictable pricing

**Slab Structure:**
```
₹1 - ₹50,000        → ₹12
₹50,001 - ₹100,000  → ₹15
₹100,001 - ₹200,000 → ₹20
₹200,001+           → ₹25
```

**Implementation:**
- Schema-level payout PG assignment
- Payout slabs defined per schema
- Admin can modify slabs anytime

---

### 2. PAYIN System (Transaction Channel-Based)

**Hierarchy:**
```
Schema
  ├── Payment Gateway (Razorpay)
  │     ├── UPI → 2.0%
  │     ├── Net Banking → 2.2%
  │     ├── Debit Card → 2.5%
  │     └── Credit Card
  │           ├── VISA Normal → 2.8%
  │           ├── VISA Corporate → 3.0%
  │           ├── MasterCard Normal → 2.8%
  │           ├── MasterCard Corporate → 3.0%
  │           ├── RuPay → 2.5%
  │           ├── Amex → 3.5%
  │           └── Diners → 3.5%
  │
  └── Payment Gateway (Sabpaisa)
        ├── UPI → 1.8%
        ├── Net Banking → 2.0%
        └── Credit Card
              ├── VISA Normal → 2.6%
              └── MasterCard Normal → 2.6%
```

**Standard Transaction Channels:**

1. **UPI** - Unified Payments Interface
2. **Net Banking** - All bank net banking
3. **Debit Card** - All debit cards
4. **Wallet** - PayTM, PhonePe, etc.

5. **Credit Card Types:**
   - VISA Normal
   - VISA Corporate  
   - VISA Premium
   - MasterCard Normal
   - MasterCard Corporate
   - MasterCard Premium
   - RuPay
   - Amex (American Express)
   - Diners Club
   - Discover
   - JCB
   - UnionPay

**Admin Features:**
- Add new transaction channels dynamically
- Configure rates per PG per channel
- Set default rates for new channels

---

## Database Schema Changes

### Modified Tables

#### 1. **PaymentGateway** (Keep mostly same)
```prisma
model PaymentGateway {
  id              String    @id @default(uuid())
  name            String    @unique
  code            String    @unique
  
  // Payout or Payin capable
  supportedTypes  String    @default("PAYIN,PAYOUT")
  
  isActive        Boolean   @default(true)
  
  // Relations
  transactions    Transaction[]
  transactionChannels TransactionChannel[] // Available channels for this PG
  schemaPayinRates    SchemaPayinRate[]   // Payin rates per schema
  schemaPayoutConfig  SchemaPayoutConfig? // Payout config per schema
}
```

#### 2. **TransactionChannel** (NEW - Replaces CardType)
Defines available payment channels per PG (UPI, Cards, etc.)

```prisma
model TransactionChannel {
  id              String    @id @default(uuid())
  pgId            String
  paymentGateway  PaymentGateway @relation(fields: [pgId], references: [id], onDelete: Cascade)
  
  // Channel identification
  code            String    // e.g., "upi", "netbanking", "credit_visa_normal"
  name            String    // e.g., "UPI", "Net Banking", "VISA Normal Card"
  category        String    // "UPI", "NETBANKING", "DEBITCARD", "CREDITCARD", "WALLET"
  
  // For card types - additional metadata
  cardNetwork     String?   // "VISA", "MASTER", "RUPAY", "AMEX", "DINERS"
  cardType        String?   // "NORMAL", "CORPORATE", "PREMIUM", "PLATINUM"
  
  // PG's cost for this channel (base rate)
  baseCost        Float     @default(0.02)
  
  // Is this channel active
  isActive        Boolean   @default(true)
  
  // Is this admin-defined or system-defined
  isCustom        Boolean   @default(false)
  
  // Mapping to PG response codes (JSON array)
  // e.g., ["visa", "VISA", "Visa Card"] - helps match PG responses
  pgResponseCodes String?   // JSON array
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  schemaRates     SchemaPayinRate[]
  userRates       UserPayinRate[]
  transactions    Transaction[]
  
  @@unique([pgId, code])
  @@index([pgId])
  @@index([category])
  @@index([cardNetwork])
}
```

#### 3. **Schema** (Modified)
```prisma
model Schema {
  id              String    @id @default(uuid())
  name            String
  code            String    @unique
  
  // Payout PG for this schema (ONE PG)
  payoutPGId      String?
  payoutPG        PaymentGateway? @relation("SchemaPayoutPG", fields: [payoutPGId], references: [id])
  
  isActive        Boolean   @default(true)
  
  // Relations
  users           User[]
  payinRates      SchemaPayinRate[]   // Payin rates per channel
  payoutConfig    SchemaPayoutConfig? // Payout slab configuration
}
```

#### 4. **SchemaPayinRate** (NEW - Replaces SchemaPGRate for payin)
Per schema, per PG, per channel rate configuration

```prisma
model SchemaPayinRate {
  id                  String    @id @default(uuid())
  schemaId            String
  schema              Schema    @relation(fields: [schemaId], references: [id], onDelete: Cascade)
  
  channelId           String
  transactionChannel  TransactionChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  
  // Rate for this schema + channel combination (percentage)
  payinRate           Float     @default(0.02) // 2% default
  
  // Is this channel enabled for this schema
  isEnabled           Boolean   @default(true)
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@unique([schemaId, channelId])
  @@index([schemaId])
  @@index([channelId])
}
```

#### 5. **SchemaPayoutConfig** (NEW - Replaces payout in SchemaPGRate)
Payout configuration per schema with slab-based pricing

```prisma
model SchemaPayoutConfig {
  id              String    @id @default(uuid())
  schemaId        String    @unique
  schema          Schema    @relation(fields: [schemaId], references: [id], onDelete: Cascade)
  
  // The designated payout PG for this schema
  pgId            String
  paymentGateway  PaymentGateway @relation("SchemaPayoutPG", fields: [pgId], references: [id])
  
  // Payout uses SLAB-based flat charges only
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Slabs for this schema
  slabs           PayoutSlab[]
}
```

#### 6. **PayoutSlab** (Modified - belongs to SchemaPayoutConfig)
```prisma
model PayoutSlab {
  id                    String    @id @default(uuid())
  schemaPayoutConfigId  String
  config                SchemaPayoutConfig @relation(fields: [schemaPayoutConfigId], references: [id], onDelete: Cascade)
  
  minAmount             Float     // Inclusive
  maxAmount             Float?    // Inclusive, null = unlimited
  flatCharge            Float     // Flat fee in rupees
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  @@index([schemaPayoutConfigId])
}
```

#### 7. **UserPayinRate** (NEW - Hierarchical payin rates)
User-level overrides for payin rates (assigned by parent)

```prisma
model UserPayinRate {
  id                  String    @id @default(uuid())
  
  // User this rate applies to
  userId              String
  user                User      @relation("UserPayinRates", fields: [userId], references: [id], onDelete: Cascade)
  
  // Transaction channel this rate is for
  channelId           String
  transactionChannel  TransactionChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  
  // Who assigned this rate
  assignedById        String
  assignedBy          User      @relation("PayinRatesAssigned", fields: [assignedById], references: [id])
  
  // Custom rate for this user
  payinRate           Float
  
  isEnabled           Boolean   @default(true)
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  @@unique([userId, channelId])
  @@index([userId])
  @@index([channelId])
  @@index([assignedById])
}
```

#### 8. **UserPayoutRate** (NEW - Hierarchical payout rates)
User-level overrides for payout (slab-based or flat)

```prisma
model UserPayoutRate {
  id              String    @id @default(uuid())
  
  // User this rate applies to
  userId          String    @unique
  user            User      @relation("UserPayoutRate", fields: [userId], references: [id], onDelete: Cascade)
  
  // Who assigned this rate
  assignedById    String
  assignedBy      User      @relation("PayoutRatesAssigned", fields: [assignedById], references: [id])
  
  // User-specific payout slabs (overrides schema slabs)
  slabs           UserPayoutSlab[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

#### 9. **UserPayoutSlab** (NEW)
```prisma
model UserPayoutSlab {
  id                String    @id @default(uuid())
  userPayoutRateId  String
  userPayoutRate    UserPayoutRate @relation(fields: [userPayoutRateId], references: [id], onDelete: Cascade)
  
  minAmount         Float
  maxAmount         Float?
  flatCharge        Float
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([userPayoutRateId])
}
```

#### 10. **Transaction** (Modified)
```prisma
model Transaction {
  id                  String    @id @default(uuid())
  transactionId       String    @unique
  type                String    // PAYIN, PAYOUT
  
  amount              Float
  pgCharges           Float
  platformCommission  Float
  netAmount           Float
  
  // Payment Gateway
  pgId                String
  paymentGateway      PaymentGateway @relation(fields: [pgId], references: [id])
  
  // Transaction Channel (replaces cardType)
  channelId           String?
  transactionChannel  TransactionChannel? @relation(fields: [channelId], references: [id])
  
  // Raw payment method from PG response
  rawPaymentMethod    String?   // Store exact value from PG for debugging
  
  // User
  initiatorId         String
  initiator           User      @relation(fields: [initiatorId], references: [id])
  
  // ... rest of fields
}
```

---

## Migration Strategy

### Phase 1: Database Migration
1. Create new tables (TransactionChannel, SchemaPayinRate, etc.)
2. Migrate existing CardType data to TransactionChannel
3. Migrate existing rates to new structure
4. Keep old tables temporarily for rollback

### Phase 2: Seed Standard Channels
Create seed script to populate standard transaction channels:
- UPI, Net Banking, Debit Card, Wallet
- All standard credit card types (VISA, Master, etc.)

### Phase 3: Admin UI Updates
1. Schema configuration page:
   - Assign payout PG
   - Configure payout slabs
   - Configure payin rates per channel
2. Transaction channel management:
   - View all channels
   - Add custom channels
   - Map PG response codes

### Phase 4: Rate Assignment Flow
1. Parent assigns rates to children
2. Rates cascade down hierarchy
3. Validation ensures parent rate > child rate

---

## Standard Transaction Channels (To be Seeded)

### Category: UPI
- `upi` - UPI Payment

### Category: NETBANKING
- `netbanking` - Net Banking

### Category: DEBITCARD
- `debitcard` - Debit Card (All)

### Category: WALLET
- `wallet` - Digital Wallet

### Category: CREDITCARD
- `credit_visa_normal` - VISA Normal
- `credit_visa_corporate` - VISA Corporate
- `credit_visa_premium` - VISA Premium
- `credit_master_normal` - MasterCard Normal
- `credit_master_corporate` - MasterCard Corporate
- `credit_master_premium` - MasterCard Premium
- `credit_rupay` - RuPay Credit
- `credit_amex` - American Express
- `credit_diners` - Diners Club
- `credit_discover` - Discover
- `credit_jcb` - JCB
- `credit_unionpay` - UnionPay

---

## API Changes

### Admin APIs

#### 1. Manage Transaction Channels
```typescript
POST /api/admin/transaction-channels
{
  "pgId": "uuid",
  "code": "credit_visa_platinum",
  "name": "VISA Platinum Card",
  "category": "CREDITCARD",
  "cardNetwork": "VISA",
  "cardType": "PLATINUM",
  "baseCost": 0.035,
  "pgResponseCodes": ["visa platinum", "VISA_PLATINUM"]
}
```

#### 2. Configure Schema Payin Rates
```typescript
POST /api/admin/schemas/{schemaId}/payin-rates
{
  "channelId": "uuid",
  "payinRate": 0.028,
  "isEnabled": true
}
```

#### 3. Configure Schema Payout
```typescript
POST /api/admin/schemas/{schemaId}/payout-config
{
  "pgId": "uuid",
  "slabs": [
    { "minAmount": 1, "maxAmount": 50000, "flatCharge": 12 },
    { "minAmount": 50001, "maxAmount": 100000, "flatCharge": 15 },
    { "minAmount": 100001, "maxAmount": 200000, "flatCharge": 20 },
    { "minAmount": 200001, "maxAmount": null, "flatCharge": 25 }
  ]
}
```

### User APIs

#### 1. Assign Child Payin Rates
```typescript
POST /api/users/{userId}/payin-rates
{
  "channelId": "uuid",
  "payinRate": 0.03, // Must be > parent's rate
  "assignToUserId": "child-user-uuid"
}
```

#### 2. Assign Child Payout Rates
```typescript
POST /api/users/{userId}/payout-rates
{
  "slabs": [
    { "minAmount": 1, "maxAmount": 50000, "flatCharge": 15 },
    { "minAmount": 50001, "maxAmount": null, "flatCharge": 20 }
  ],
  "assignToUserId": "child-user-uuid"
}
```

---

## Benefits of New System

1. **Simpler Structure**: One place for all PG rates (including channels)
2. **Flexible**: Admin can add new transaction channels anytime
3. **Predictable Payout**: Slab-based flat charges easy to understand
4. **Scalable**: Works for any number of PGs and channels
5. **Clear Hierarchy**: Schema → User → Child User rates
6. **Better Matching**: PG response codes help auto-detect channel
7. **Single Source of Truth**: No duplicate rate configurations

---

## Next Steps

1. **Review & Approve**: Review this proposal and confirm changes
2. **Create Migration Script**: Write Prisma migration
3. **Seed Standard Channels**: Create seed data for all channels
4. **Update Services**: Modify rate.service.ts and transaction.service.ts
5. **Update Admin UI**: Create new pages for channel management
6. **Testing**: Thorough testing with all PGs
7. **Documentation**: Update API docs and user guides

---

## Questions for Clarification

1. Should we allow multiple payout PGs per schema or strictly one?
2. What should happen if PG returns unknown channel type?
3. Should users be able to override payout slabs or only schema-level?
4. Do you want percentage-based payout option or only slab-based?
5. Should we maintain backwards compatibility with old system?
