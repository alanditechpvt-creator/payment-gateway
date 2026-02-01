# WebsiteNew - Service Startup Guide

## Quick Start - 4 Terminal Approach

Open 4 separate terminal windows and run these commands:

### Terminal 1: Backend API (Port 4100)
```bash
cd d:\WebsiteNew\WebsiteNew\backend
npm run dev
```
✅ Expected: Server running on http://127.0.0.1:4100

---

### Terminal 2: Frontend Web App (Port 5000)
```bash
cd d:\WebsiteNew\WebsiteNew\frontend
npm run dev
```
✅ Expected: App running on http://localhost:5000

---

### Terminal 3: Admin Dashboard (Port 5002)
```bash
cd d:\WebsiteNew\WebsiteNew\admin
npm run dev
```
✅ Expected: App running on http://localhost:5002

---

### Terminal 4: Mobile App
```bash
cd d:\WebsiteNew\WebsiteNew\mobile
npm start
```
✅ Expected: Metro bundler running, QR code displayed

---

## Login Credentials

### Admin Panel (http://localhost:5002)
- Email: `admin@newweb.com`
- Password: `Admin@123456`

### Web & Mobile
- Login with admin credentials above
- Or create new users from Admin Panel

---

## Mobile App Testing

### Option 1: Expo Go (Recommended for Testing)
1. Install Expo Go app on your phone (iOS/Android)
2. Scan QR code from Terminal 4
3. App will load on your phone

### Option 2: Android Emulator
1. Have Android emulator running
2. Press `a` in Terminal 4
3. App will auto-install and launch

### Option 3: Web Preview
1. Press `w` in Terminal 4
2. Opens in browser (limited functionality)

---

## Important: Update Mobile API URL

Edit `mobile/src/api/index.ts` line 11:

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://YOUR_COMPUTER_IP:4100/api';
```

Replace `YOUR_COMPUTER_IP` with:
1. Open Command Prompt
2. Run: `ipconfig`
3. Look for "IPv4 Address" (e.g., 192.168.x.x)
4. Use that IP in the API_URL

---

## Troubleshooting

### Backend won't start
```bash
# Check if port 4100 is in use
netstat -ano | findstr :4100

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>

# Try again
npm run dev
```

### Mobile app shows blank screen
1. Press `r` in Terminal 4 to reload
2. Check mobile device has network access to backend IP
3. Verify backend is running on correct port
4. Check API_URL in `mobile/src/api/index.ts` is correct

### Port already in use
```bash
# Kill all Node processes
taskkill /F /IM node.exe

# Or use specific port
npm run dev -- --port 5001  # Use different port
```

### Database errors
```bash
cd backend
npx prisma db push
npx prisma db seed
npm run dev
```

---

## Monitor Status

✅ **All services running:**
- Backend: http://127.0.0.1:4100/api/health (check this URL)
- Frontend: http://localhost:5000
- Admin: http://localhost:5002
- Mobile: Scan QR code or emulator

---

## Next Steps After Startup

1. ✅ Verify all 4 services start without errors
2. ✅ Open Admin panel: http://localhost:5002
3. ✅ Login with admin credentials
4. ✅ Create test users from Admin panel
5. ✅ Test mobile app with created users
6. ✅ Create transactions to verify API integration

---

**Duration:** All services should be fully running within 2-3 minutes of starting them.
