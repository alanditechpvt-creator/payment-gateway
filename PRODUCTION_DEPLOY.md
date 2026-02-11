# Production Deployment - Response Codes Feature

## Changes Pushed (Commit: c64446f)

### New Features:
1. **Response Codes Management UI** - Admins can configure PG API response mappings
2. **Channel-based Rate System** - Complete migration from PG-based to channel-based rates
3. **BBPS Integration** - Automatic channel detection for bill payments

### Files Changed:
- Backend: channelAdmin.controller.ts, channelAdmin.routes.ts, channelRate.service.ts
- Frontend: AdminDashboard.tsx (Response Codes view)
- Database: CachedBill model, announcement service fixes

## Deployment Steps

### 1. Pull Latest Code on Production Server

```bash
cd /path/to/payment-gateway
git pull origin main
```

### 2. Backend Deployment

```bash
cd backend

# Install dependencies (if package.json changed)
npm install

# Generate Prisma Client
npx prisma generate

# Run database migrations (if needed)
npx prisma migrate deploy

# Restart backend service
pm2 restart payment-gateway-backend
# OR
systemctl restart payment-gateway-backend
```

### 3. Admin Panel Deployment

```bash
cd admin

# Install dependencies
npm install

# Build production version
npm run build

# Restart admin service
pm2 restart payment-gateway-admin
# OR
systemctl restart payment-gateway-admin
```

### 4. Verify Deployment

#### Check Backend API:
```bash
curl http://your-production-ip:4100/api/health
```

Expected Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-11T..."
}
```

#### Check Admin Panel:
```
http://your-production-ip:5002
```

Login and navigate to:
`Schemas → Configure Rates → Select PG → PAYIN Channels → Response Codes`

### 5. Test BBPS on Production

#### Test Bill Fetch:
```bash
curl -X POST http://your-production-ip:4100/api/bbps/fetch-bill \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "ELECTRICITY",
    "billerId": "BSES12345",
    "params": {
      "ca_number": "1234567890"
    }
  }'
```

#### Test Bill Payment:
```bash
curl -X POST http://your-production-ip:4100/api/bbps/pay-bill \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "billId": "cached-bill-id",
    "amount": 1000,
    "pgCode": "RAZORPAY"
  }'
```

### 6. Configure Response Codes (Important!)

After deployment, configure response codes for each payment gateway:

1. **Login to Admin Panel** → http://your-production-ip:5002
2. **Navigate**: Schemas → Configure Rates → Select Payment Gateway
3. **Click**: "Response Codes" button
4. **Configure** each channel with PG-specific response codes

#### Example Configurations:

**For Razorpay:**
- Visa: `visa, VISA, card, credit_card`
- Mastercard: `mastercard, master, MASTERCARD`
- UPI: `upi, UPI`

**For SabPaisa:**
- Visa: `VISA, VI, Credit Card - Visa`
- Mastercard: `MASTERCARD, MC, Credit Card - MasterCard`

### 7. Monitor Logs

```bash
# Backend logs
pm2 logs payment-gateway-backend

# Check for channel detection
tail -f logs/app.log | grep "Channel detected"

# Check for errors
tail -f logs/error.log
```

### 8. Database Backup (Before Testing)

```bash
cd backend
# Backup current database
cp prod.db prod.db.backup.$(date +%Y%m%d_%H%M%S)
```

## Rollback Plan (If Issues Occur)

### Quick Rollback:
```bash
cd /path/to/payment-gateway
git checkout c4258e0  # Previous commit
cd backend && npm install && npx prisma generate
pm2 restart all
```

### Restore Database:
```bash
cd backend
cp prod.db.backup.YYYYMMDD_HHMMSS prod.db
pm2 restart payment-gateway-backend
```

## New API Endpoints

### PATCH /api/admin/channels/:id/response-codes
Update response codes for a channel

**Request:**
```json
{
  "responseCodes": ["visa", "VISA", "credit_card_visa"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Response codes updated successfully",
  "data": { /* updated channel */ }
}
```

## Testing Checklist

- [ ] Backend health check passes
- [ ] Admin panel loads successfully
- [ ] Can login to admin panel
- [ ] Response Codes UI accessible
- [ ] Can edit and save response codes
- [ ] BBPS bill fetch works
- [ ] BBPS payment creation works
- [ ] Channel detection logs appear correctly
- [ ] Transaction charges calculated properly

## Support

If issues occur:
1. Check logs: `pm2 logs payment-gateway-backend`
2. Verify database: `npx prisma studio`
3. Test API endpoints with curl
4. Check Prisma client generation: `npx prisma generate`

## Production Environment Variables

Ensure these are set in production `.env`:

```bash
DATABASE_URL="file:./prod.db"
NODE_ENV="production"
PORT=4100

# Payment Gateway Credentials
RAZORPAY_KEY_ID="your_prod_key"
RAZORPAY_KEY_SECRET="your_prod_secret"
SABPAISA_CLIENT_CODE="your_prod_code"
SABPAISA_AUTH_KEY="your_prod_key"

# BBPS Configuration
BBPS_ENABLED=true
BBPS_MOCK_MODE=false  # Set to false for live testing
```

## Post-Deployment Tasks

1. Configure response codes for all active payment gateways
2. Test with small transactions first
3. Monitor transaction logs for channel detection accuracy
4. Update response codes based on actual PG responses
5. Document any PG-specific response format variations

---

**Deployed By:** [Your Name]
**Deployed On:** 2026-02-11
**Commit Hash:** c64446f
**Previous Commit:** c4258e0
