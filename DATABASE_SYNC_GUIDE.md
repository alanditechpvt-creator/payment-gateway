# Database Sync Guide

## Problem
Unlike code changes which are tracked in git, **database changes are NOT automatically synced** between local and production environments.

When you run seed scripts on production (VPS), those changes (new PGs, channels, schemas, etc.) only exist in the production database - **NOT in your local dev.db**.

## Current Database State

### Production (VPS - prod.db)
```
Payment Gateways: 5
├── Razorpay (19 channels) ✅
├── PayU (19 channels) ✅
├── Cashfree (19 channels) ✅
├── Paytm (19 channels) ✅
└── Sabpaisa (19 channels) ✅

Total: 95 channels
```

### Local (dev.db)
```
Payment Gateways: 5
├── Razorpay (19 channels) ✅
├── PayU (16 channels) ⚠️
├── Cashfree (19 channels) ✅
├── Paytm (16 channels) ⚠️
└── Sabpaisa (19 channels) ✅

Total: 89 channels
```

## How to Keep Local & Production In Sync

### Quick Sync Commands

**Run these whenever you seed data on production:**

```powershell
# From backend folder
cd backend

# 1. Seed Payment Gateways
npx ts-node prisma/seed-pgs.ts

# 2. Seed Transaction Channels
npx ts-node prisma/seed-transaction-channels.ts

# 3. Verify sync
npx ts-node check-local-sync.ts
```

### Complete Database Reset (If needed)

If your local database gets out of sync:

```powershell
cd backend

# Option 1: Delete and recreate (CAUTION: Loses all local data)
Remove-Item prisma/dev.db
npx prisma migrate dev
npx prisma generate

# Option 2: Reset and re-seed
npx prisma migrate reset  # This will drop all data and re-run migrations
# Then run seed scripts as needed

# Option 3: Manual sync (safer - only adds missing data)
npx ts-node prisma/seed-pgs.ts
npx ts-node prisma/seed-transaction-channels.ts
npx ts-node check-local-sync.ts
```

## Seed Scripts Available

### 1. seed-pgs.ts
**Purpose**: Seeds all 5 payment gateways
**PGs Created**:
- Razorpay (RAZORPAY)
- PayU (PAYU)
- Cashfree (CASHFREE)
- Paytm (PAYTM)
- Sabpaisa (SABPAISA)

**Usage**:
```bash
# Local
npx ts-node prisma/seed-pgs.ts

# Production
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   npx ts-node prisma/seed-pgs.ts"
```

### 2. seed-transaction-channels.ts
**Purpose**: Seeds 19 channels per PG (95 total)
**Channels**:
- UPI, Net Banking, Debit Card, Digital Wallet
- Credit Card variants (VISA, MasterCard, RuPay, Amex, Diners, etc.)
- Payout methods (IMPS, NEFT)
- Fallback channels

**Usage**:
```bash
# Local
npx ts-node prisma/seed-transaction-channels.ts

# Production
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   npx ts-node prisma/seed-transaction-channels.ts"
```

### 3. seed.ts (Full seed - use with caution)
**Purpose**: Complete database seeding including:
- Admin user
- Sample schemas
- PGs (only 4 - outdated, use seed-pgs.ts instead)
- Schema rates

**Usage**:
```bash
npx prisma db seed
```

**⚠️ WARNING**: This creates a default admin user with password. Don't use in production if admin already exists.

## Check Sync Status

### Quick Check
```powershell
cd backend
npx ts-node check-local-sync.ts
```

**Output**:
```
🔍 Checking local database sync...

Payment Gateways with Channel Counts:
═══════════════════════════════════════
Cashfree (CASHFREE): 19 channels
PayU (PAYU): 16 channels
Paytm (PAYTM): 16 channels
Razorpay (RAZORPAY): 19 channels
Sabpaisa (SABPAISA): 19 channels

✅ Local database sync check complete!
```

### Manual Database Query
```powershell
# Local
cd backend
npx prisma studio  # Opens GUI to browse database

# Or use SQL directly
sqlite3 prisma/dev.db "SELECT name, code FROM PaymentGateway;"
```

## When to Sync

### ✅ Always sync after:
1. Running seed scripts on production
2. Pulling code that includes new migrations
3. Switching branches with different schema
4. After running `prisma migrate dev`

### ⚠️ Things that DON'T auto-sync:
- ❌ Seed scripts (must run on both environments)
- ❌ Manual database inserts
- ❌ Data created via API calls
- ❌ Test data created during development

### ✅ Things that DO sync automatically:
- ✅ Schema changes (via migrations)
- ✅ Code changes (via git)
- ✅ Configuration files

## Production Database Management

### View Production Data
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18

cd /var/www/payment-gateway/backend

# Quick queries
sqlite3 prisma/prod.db "SELECT * FROM PaymentGateway;"
sqlite3 prisma/prod.db "SELECT COUNT(*) FROM TransactionChannel;"

# Interactive mode
sqlite3 prisma/prod.db
sqlite> .tables
sqlite> SELECT * FROM User;
sqlite> .quit
```

### Backup Production Database
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend/prisma; \
   cp prod.db prod.db.backup-$(date +%Y%m%d-%H%M%S)"
```

### Copy Production Data to Local (for testing)
```powershell
# Download production database
scp -i D:\ssh_imp pgadmin@72.61.254.18:/var/www/payment-gateway/backend/prisma/prod.db ./backend/prisma/prod-copy.db

# Open in Prisma Studio to inspect
cd backend
DATABASE_URL="file:./prisma/prod-copy.db" npx prisma studio
```

## Common Issues

### Issue: "Table X doesn't exist"
**Cause**: Migrations not applied
**Fix**:
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### Issue: Local has different data than production
**Cause**: Seed scripts not run on local after running on production
**Fix**:
```bash
cd backend
npx ts-node prisma/seed-pgs.ts
npx ts-node prisma/seed-transaction-channels.ts
npx ts-node check-local-sync.ts
```

### Issue: Migration conflicts
**Cause**: Schema changed on production but not locally (or vice versa)
**Fix**:
```bash
# Pull latest code first
git pull origin main

# Then apply migrations
cd backend
npx prisma migrate dev
```

### Issue: "Unique constraint violation"
**Cause**: Trying to seed data that already exists
**Fix**: Seed scripts use `upsert` which should handle this. If it still fails:
```bash
# Check what exists
sqlite3 prisma/dev.db "SELECT code FROM PaymentGateway;"

# Either delete conflicting records or modify seed script
```

## Best Practices

### 1. Document Database Changes
When you make database changes (seeds, migrations):
- ✅ Commit the seed script or migration to git
- ✅ Document what data was added
- ✅ Tell team members to run sync commands

### 2. Use Seed Scripts, Not Manual Inserts
```bash
# ❌ DON'T: Manual SQL inserts
sqlite3 prod.db "INSERT INTO PaymentGateway ..."

# ✅ DO: Create reusable seed script
# backend/prisma/seed-something.ts
# Then run on both environments
```

### 3. Test Locally First
Before running seeds on production:
```bash
# Test locally first
cd backend
npx ts-node prisma/seed-pgs.ts
npx ts-node check-local-sync.ts

# If looks good, run on production
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend; \
   npx ts-node prisma/seed-pgs.ts"
```

### 4. Keep Environments Consistent
```
Development (Local) → Staging → Production
      ↓                 ↓           ↓
  Same PGs          Same PGs    Same PGs
  Same Channels     Same Channels  Same Channels
  Test data         Test data   Real data
```

## Summary

**Remember**:
- 📝 **Code** syncs via git automatically
- 🗄️ **Database schema** syncs via migrations
- 💾 **Database data** must be synced manually (seed scripts)

**Workflow**:
1. Make changes locally (code + database)
2. Test locally
3. Commit code to git
4. Run seed scripts locally
5. Push to git
6. Deploy code to production (safe-deploy.ps1)
7. Run same seed scripts on production
8. Verify both environments match

**Quick Sync**:
```powershell
# Run these on both local and production after database changes
npx ts-node prisma/seed-pgs.ts
npx ts-node prisma/seed-transaction-channels.ts
npx ts-node check-local-sync.ts
```
