# Old Models Cleanup Summary

**Date**: February 12, 2026  
**Task**: Remove old CardType, schemaPGRate, and userPGRate models that no longer exist in the schema

## ✅ Completed Actions

### 1. Moved Deprecated Files to `deprecated/` Folder

**Services** (`backend/src/services/deprecated/`):
- `cardType.service.ts` - 605 lines, all CardType CRUD operations
- `schema.service.ts` - 451 lines, old schemaPGRate management

**Controllers** (`backend/src/controllers/deprecated/`):
- `cardType.controller.ts` - Controller for cardType routes
- `schema.controller.ts` - Controller for schema PG rate routes

**Routes** (`backend/src/routes/deprecated/`):
- `cardType.routes.ts` - `/card-types` endpoints
- `schema.routes.ts` - `/schemas` endpoints (setPGRates, addPGRate, removePGRate)

### 2. Cleaned Up Active Files

**transaction.service.ts** (1034 lines):
- ❌ Removed import: `import { cardTypeService } from './cardType.service';`
- ❌ Removed: Card type resolution from PG response in `markAsSuccess()`
- ❌ Removed: cardTypeId from transaction update
- ❌ Removed: CardType-based rate calculations in `calculateCommissions()`
- ❌ Removed: Old schemaPGRate reference in `getPayoutSlabs()` → Now uses `SchemaPayoutConfig`
- ❌ Removed: `updateTransactionWithCardType()` method (36 lines)
- ❌ Removed: `recalculateChargesWithCardType()` method (61 lines)
- ❌ Removed: `getTransactionRateBreakdown()` method (35 lines)
- ✅ **Simplified to use channel-based rate system only**

**rate.service.ts** (600 lines):
- ❌ Removed import: `import { cardTypeService } from './cardType.service';`
- ✅ All rate lookups now use UserPGAssignment and channel-based rates

**pg.service.ts** (267 lines):
- ❌ Removed: `await prisma.schemaPGRate.deleteMany({ where: { pgId } });`
- ⚠️ Commented out: `getPayoutSlabsForUser()` method (45 lines) - uses old schemaPGRate model
- ✅ Note added for future cleanup of SchemaPayoutConfig

**routes/index.ts** (90 lines):
- ❌ Removed import: `import cardTypeRoutes from './cardType.routes';`
- ❌ Removed import: `import schemaRoutes from './schema.routes';`
- ❌ Removed route: `router.use('/card-types', cardTypeRoutes);`
- ❌ Removed route: `router.use('/schemas', schemaRoutes);`

### 3. Commented Out Deprecated Validators & Types

**validators/index.ts** (325 lines):
- ⚠️ Commented out: `schemaPGRateSchema` (Zod validator)
- ⚠️ Commented out: `createCardTypeSchema` (Zod validator)
- ⚠️ Commented out: `updateCardTypeSchema` (Zod validator)
- ⚠️ Commented out: `assignCardTypeRateSchema` (Zod validator)
- ⚠️ Removed from exports: All above schemas marked as DEPRECATED

**types/index.ts** (153 lines):
- ⚠️ Commented out: `SchemaPGRateDTO` interface

## 📊 TypeScript Errors Reduced

- **Before**: 236 errors
- **After**: 201 errors
- **Reduction**: 35 errors fixed ✅

Remaining errors are mostly:
- Pre-existing schema mismatches (Announcement, Beneficiary, User models)
- JWT/auth type issues
- Webhook controller type mismatches
- These are NOT related to the old model cleanup

## 🗂️ Current System Architecture

### Old Models (REMOVED from schema):
- ❌ `CardType` - Card type definitions with base rates
- ❌ `SchemaPGRate` - Schema-level PG rates (payin/payout)
- ❌ `UserPGRate` - User-level PG rate overrides
- ❌ `SchemaCardTypeRate` - Schema-level card type rates
- ❌ `UserCardTypeRate` - User-level card type rate overrides

### New Models (IN USE):
- ✅ `TransactionChannel` - 19 channels per PG (UPI, Cards, Wallets, etc.)
- ✅ `SchemaPayinRate` - Schema rates per channel
- ✅ `SchemaPayoutConfig` - Schema payout configuration with slabs
- ✅ `UserPGAssignment` - User PG assignment (enabled/disabled)
- ✅ `UserPayinRate` - User custom payin rates per channel
- ✅ `UserPayoutRate` - User custom payout rates

### Rate Hierarchy:
```
1. TransactionChannel.baseCost (2.8% for VISA Normal) - PG's cost
2. SchemaPayinRate.payinRate (3.0%) - Schema-level rate
3. UserPayinRate.payinRate (3.5%) - User override rate
```

## 📝 What Deprecated Files Did

### cardType.service.ts
- Created card types for PGs (VISA, Master, RuPay, etc.)
- Managed base rates per card type
- Auto-created card types from PG responses
- Assigned card type-specific rates to users
- Calculated charges based on card type

**Why removed**: 
- Card types are now channels (TransactionChannel model)
- Base rates moved to TransactionChannel.baseCost
- More flexible channel-based system

### schema.service.ts (old methods)
- `setPGRates()` - Set payin/payout rates per PG for schema
- `addPGRate()` - Add/update PG rate for schema
- `removePGRate()` - Remove PG rate from schema
- `setPayoutSlabs()` - Configure payout slabs
- `updatePayoutSettings()` - Update payout charge type

**Why removed**:
- Old schemaPGRate model doesn't exist
- New system uses SchemaPayinRate (per channel) and SchemaPayoutConfig
- More granular control at channel level

### cardType.controller.ts & Routes
- GET `/api/card-types` - List all card types
- GET `/api/card-types/pg/:pgId` - Get card types by PG
- POST `/api/card-types` - Create card type
- PATCH `/api/card-types/:id` - Update card type
- POST `/api/card-types/:id/toggle` - Enable/disable

**Why removed**:
- No longer needed with channel-based system
- TransactionChannel seeded via `seed-transaction-channels.ts`

## 🔄 Migration Path for Future

If you need to restore ANY old functionality:

1. **CardType functionality** → Use `TransactionChannel` model
   - Example: VISA Normal = TransactionChannel with code `CREDIT_CARD_VISA_NORMAL`
   
2. **Schema PG rates** → Use `SchemaPayinRate` + `SchemaPayoutConfig`
   - Example: Schema Platinum rate for VISA = SchemaPayinRate record
   
3. **User card type rates** → Use `UserPayinRate`
   - Example: User override for VISA = UserPayinRate record

## 📂 File Locations

### Deprecated (Still in codebase, not loaded):
```
backend/src/
├── services/deprecated/
│   ├── cardType.service.ts     (605 lines)
│   └── schema.service.ts       (451 lines)
├── controllers/deprecated/
│   ├── cardType.controller.ts  (~200 lines)
│   └── schema.controller.ts    (179 lines)
└── routes/deprecated/
    ├── cardType.routes.ts      (36 lines)
    └── schema.routes.ts        (36 lines)
```

### Active (Cleaned up):
```
backend/src/
├── services/
│   ├── transaction.service.ts  (1034 lines - cleaned)
│   ├── rate.service.ts         (600 lines - cleaned)
│   └── pg.service.ts           (267 lines - cleaned)
├── routes/
│   └── index.ts                (90 lines - cleaned)
├── validators/
│   └── index.ts                (325 lines - deprecated schemas commented)
└── types/
    └── index.ts                (153 lines - deprecated types commented)
```

## ✨ Benefits

1. **Cleaner Codebase**: Removed 132 lines of dead code from active files
2. **Fewer TypeScript Errors**: 35 errors fixed
3. **Better Architecture**: Channel-based system is more flexible
4. **Easier Maintenance**: No confusion between old and new rate systems
5. **Preserved History**: Old files in `deprecated/` folder for reference

## ⚠️ Important Notes

1. **Deprecated folder files will NOT compile** - They have import errors by design
2. **Don't delete deprecated/ folders** - Keep for historical reference
3. **API routes removed**: 
   - `/api/card-types/*` → 404
   - `/api/schemas/:id/rates` → 404
4. **Admin panel** may have broken UI if it used old endpoints
5. **Database**: Old models don't exist, so no data migration needed

## 🚀 Next Steps

1. ✅ **DONE**: Clean up old model references
2. ⏭️ **TODO**: Fix remaining 201 TypeScript errors (non-related issues)
3. ⏭️ **TODO**: Update admin panel if it uses old `/card-types` or `/schemas/rates` endpoints
4. ⏭️ **TODO**: Test channel-based rate assignments thoroughly
5. ⏭️ **TODO**: Eventually delete `deprecated/` folders (keep for at least 1 month)

## 📚 Related Documentation

- [NEW_RATE_SYSTEM_GUIDE.md](NEW_RATE_SYSTEM_GUIDE.md) - Channel-based rate system
- [BASE_RATE_CONFIGURATION.md](BASE_RATE_CONFIGURATION.md) - Where base rates are set
- [RATE_SYSTEM_REDESIGN.md](RATE_SYSTEM_REDESIGN.md) - Original redesign plan
- [DATABASE_SYNC_GUIDE.md](DATABASE_SYNC_GUIDE.md) - Database synchronization

---

**Summary**: Successfully removed all references to `CardType`, `schemaPGRate`, and `userPGRate` models from active codebase. System now uses channel-based rate architecture exclusively. Old files preserved in `deprecated/` folders for reference.
