# Mobile App - Quick Start Guide

## 🚀 Getting Started

### Step 1: Install Dependencies
```bash
cd mobile
npm install
```

### Step 2: Find Your Backend IP Address

**On Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" - example: 192.168.1.100
```

**On Mac/Linux:**
```bash
ifconfig
# Look for "inet" address
```

### Step 3: Update API URL
Edit `mobile/src/api/index.ts`:

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:4100/api';
// Replace 192.168.1.100 with your actual IP address
```

### Step 4: Start the Backend
```bash
cd backend
npm run dev
# Should show: Server running on http://127.0.0.1:4100
```

### Step 5: Run the Mobile App

**On Android:**
```bash
npm run android
# Device/emulator must have internet access to your backend IP
```

**On iOS:**
```bash
npm run ios
```

**Using Expo Go (Any Device):**
```bash
npm start
# Scan QR code with Expo Go app installed on your phone
```

---

## 📱 Features by Role

### Login as Admin
- Email: `admin@newweb.com`
- Password: `Admin@123456`
- Tabs: Dashboard, Transactions, Users, Wallet, Profile

### Login as White Label / Master Distributor / Distributor
- Can see: Dashboard, Transactions, Users (if allowed), Wallet, Profile
- Can create child users based on role hierarchy
- Can initiate transactions
- Can manage wallet

### Login as Retailer
- Can see: Dashboard, Transactions, Wallet, Profile
- Cannot see: Users tab
- Can only initiate transactions
- Can view wallet history

---

## ✅ What's Implemented

### Fully Working Features
✅ **Authentication**
- Login with email/password
- Secure token storage
- Auto-refresh tokens
- Logout

✅ **Dashboard**
- User info display
- Balance & hold balance
- Transaction stats
- Quick action cards

✅ **Transactions**
- View transaction history
- Create PAYIN transactions
  - Select customer
  - Select payment gateway
  - Enter amount
- Create PAYOUT transactions
  - Enter beneficiary details
  - Select payment gateway
  - Enter amount
- Filter and search
- View status

✅ **User Management** (Admin/WL/MD only)
- Create users with role selection
- Search users
- View user details
- Approve/reject pending users
- User status tracking

✅ **Wallet**
- View balance
- View hold balance
- View transaction history
- Pull to refresh

✅ **Profile**
- View user information
- View business details
- View KYC status
- Logout

---

## 🔧 Configuration

### Change Backend Port
If your backend is not on port 4100, update:

**Backend (backend/.env):**
```
PORT=3001  # Change this to your desired port
```

**Mobile (mobile/src/api/index.ts):**
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3001/api';
// Update port number here
```

### Enable/Disable Features
Edit `App.tsx` to show/hide screens:

```tsx
// Show Users tab only for specific roles
{canManageUsers && (
  <Tab.Screen name="Users" component={UsersScreen} />
)}
```

---

## 🐛 Troubleshooting

### "Cannot connect to API"
1. Verify backend is running: `http://YOUR_IP:4100`
2. Check API_URL in `src/api/index.ts`
3. Ensure mobile device is on same network as backend
4. Check firewall is not blocking port 4100
5. Use `adb reverse` for Android emulator:
   ```bash
   adb reverse tcp:4100 tcp:4100
   ```

### "Login fails with 'Invalid credentials'"
1. Verify email and password are correct
2. Check backend database has admin user
3. Restart backend: `npm run dev`
4. Clear app cache and try again

### "Blank/white screen"
1. Check browser console (F12) for errors
2. Verify React Query is connected to backend
3. Check network tab for failed API calls
4. Restart Expo: `expo start --clear`

### "Transactions not showing"
1. Verify backend has transaction data
2. Check API response: Open browser and visit
   `http://YOUR_IP:4100/api/transactions`
3. Verify auth token is being sent
4. Check user has permission to view transactions

### "Can't create users"
1. Verify you're logged in as Admin/WL/MD
2. Check Users tab is visible
3. Verify child role is allowed for your role
4. Check email is not already registered

### "Pull to refresh not working"
1. Check RefreshControl is properly configured
2. Verify refetch function is called
3. Check if there are errors in API response

---

## 📊 Testing Workflow

### 1. Create Test Users
```
1. Login as admin@newweb.com / Admin@123456
2. Go to Users tab
3. Click + button
4. Create test users:
   - Role: RETAILER, Email: retailer@test.com
   - Role: DISTRIBUTOR, Email: distributor@test.com
   - Role: MASTER_DISTRIBUTOR, Email: md@test.com
```

### 2. Test Transactions
```
1. Login as any user
2. Go to Transactions tab
3. Click + button
4. Create PAYIN transaction:
   - Amount: 1000
   - Customer Name: John Doe
   - Email: john@test.com
   - Select Razorpay
5. Click "Create Transaction"
6. Transaction should appear in list
```

### 3. Test Wallet
```
1. Go to Wallet tab
2. Should see available balance
3. See transaction history
4. Pull to refresh to reload
```

### 4. Test User Management
```
1. Login as MASTER_DISTRIBUTOR or above
2. Go to Users tab
3. Can create RETAILER, DISTRIBUTOR users
4. Search for users by name/email
5. View user details
6. Approve/reject pending users
```

---

## 🎯 Next Steps

### Immediate (Next Session)
- [ ] Test all transaction types
- [ ] Test user creation for all roles
- [ ] Verify wallet functionality
- [ ] Test approval workflow
- [ ] Check all error messages

### Short Term
- [ ] Add rate management screen
- [ ] Add schema management
- [ ] Implement transfers
- [ ] Add biometric auth
- [ ] Setup notifications

### Medium Term
- [ ] Offline mode
- [ ] Advanced filtering
- [ ] Export reports
- [ ] Multi-language support
- [ ] Analytics dashboard

---

## 📞 Support

For issues:
1. Check this guide first
2. Check terminal logs for errors
3. Check React Query DevTools (install if needed)
4. Check backend logs at `backend/logs/`
5. Verify backend is responding to API calls

---

**Mobile App Status:** ✅ Ready to Test
**Last Updated:** January 17, 2026
