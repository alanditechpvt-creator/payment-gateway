# Channel Rate Management - Frontend Usage Guide

## Overview
Two new UI components have been added for managing per-channel rates and PG base rates.

## Components

### 1. PGBaseRateManager (Admin Only)
**Location:** `admin/src/components/PGBaseRateManager.tsx`

**Purpose:** Allows Admin to set the base rate for each Payment Gateway

**Usage:**
```tsx
import PGBaseRateManager from './components/PGBaseRateManager';

// In AdminDashboard or Settings page
<PGBaseRateManager />
```

**Features:**
- View all PGs with their current base rates
- Edit base rate inline (0% to 10%)
- Shows active/inactive status
- Real-time validation
- Success/error notifications

---

### 2. ChannelRateManager (MD/Admin)
**Location:** `admin/src/components/ChannelRateManager.tsx`

**Purpose:** Allows MD/Admin to override per-channel rates for specific users

**Usage:**
```tsx
import ChannelRateManager from './components/ChannelRateManager';

const [showChannelRates, setShowChannelRates] = useState(false);

// Trigger from user management page
<button onClick={() => setShowChannelRates(true)}>
  Manage Channel Rates
</button>

{showChannelRates && (
  <ChannelRateManager
    userId={selectedUser.id}
    pgId={selectedPG.id}
    pgName={selectedPG.name}
    onClose={() => setShowChannelRates(false)}
  />
)}
```

**Features:**
- View all channels grouped by category (Credit Card, Debit Card, UPI, etc.)
- Shows schema rate and minimum rate for each channel
- Edit multiple channel rates at once
- Highlights custom rates (green badge)
- Shows modified rates (blue badge)
- Validates rates against minimum
- Bulk save with error handling
- Reset changes before saving

---

## API Integration

All APIs are already integrated in `admin/src/lib/api.ts`:

### PG APIs
- `pgApi.updateBaseRate(pgId, baseRate)` - Update PG base rate
- `pgApi.getChannels(pgId)` - Get all channels for a PG

### Rate APIs
- `rateApi.getUserChannelRates(userId, pgId)` - Get user's channel rates
- `rateApi.updateChannelRate(userId, channelId, payinRate)` - Update single channel
- `rateApi.bulkUpdateChannelRates(userId, pgId, rates)` - Bulk update channels

---

## Integration Steps

### Step 1: Add PG Base Rate Manager to Admin Dashboard
```tsx
// In AdminDashboard.tsx, add a new tab
import PGBaseRateManager from './PGBaseRateManager';

// Add to tabs array
const tabs = [
  'users',
  'schemas',
  'transactions',
  'pg-base-rates', // NEW
  // ... other tabs
];

// In tab content rendering
{activeTab === 'pg-base-rates' && <PGBaseRateManager />}
```

### Step 2: Add Channel Rate Manager to User Management
```tsx
// In AdminDashboard.tsx, where you manage user rates
import ChannelRateManager from './ChannelRateManager';

const [showChannelRates, setShowChannelRates] = useState(false);
const [selectedUserForRates, setSelectedUserForRates] = useState<any>(null);

// Add button next to "Assign Rate" button
<button
  onClick={() => {
    setSelectedUserForRates(user);
    setSelectedPG(pg);
    setShowChannelRates(true);
  }}
  className="text-blue-400 hover:text-blue-300"
>
  Channel Rates
</button>

// Add modal at the end
{showChannelRates && selectedUserForRates && selectedPG && (
  <ChannelRateManager
    userId={selectedUserForRates.id}
    pgId={selectedPG}
    pgName={availablePGs.find(p => p.id === selectedPG)?.name || ''}
    onClose={() => {
      setShowChannelRates(false);
      setSelectedUserForRates(null);
    }}
  />
)}
```

---

## User Flow

### Admin Sets PG Base Rate:
1. Go to "PG Base Rates" tab in Admin Dashboard
2. Click "Edit Rate" next to any PG
3. Enter new base rate (e.g., 0.01 for 1%)
4. Click "Save"
5. Base rate is now applied to all users (unless they have overrides)

### MD/Admin Overrides User Channel Rates:
1. Go to user management
2. Find user and their assigned PG
3. Click "Channel Rates" button
4. Modal opens showing all channels grouped by category
5. Edit rates for specific channels (e.g., VISA Corporate = 2.5%)
6. Multiple channels can be edited at once
7. Click "Save Changes" to apply all modifications
8. User now has custom rates for those channels

---

## Rate Hierarchy (How it Works)

When a transaction happens:
1. **Check UserPayinRate** - Does this user have a custom rate for this specific channel?
2. **Check SchemaPayinRate** - If no custom rate, use the schema's rate for this channel
3. **Check PG BaseRate** - If no schema rate, use the PG's base rate

**Example:**
- PG Base Rate: 1%
- Schema VISA Normal Rate: 1.5%
- User Custom VISA Corporate Rate: 2%

Result:
- VISA Normal transactions: 1.5% (schema rate)
- VISA Corporate transactions: 2% (custom override)
- All other channels: Schema rates (or 1% base if not defined)

---

## Screenshots / UI Preview

### PG Base Rate Manager:
```
┌─────────────────────────────────────────────────┐
│ Payment Gateway Base Rates                      │
│ Set the minimum base rate for each PG          │
├─────────────────────────────────────────────────┤
│ Razorpay           [Active]         1.000%     │
│ Code: RAZORPAY                    [Edit Rate]  │
│ Note: This applies to normal cards...           │
├─────────────────────────────────────────────────┤
│ PayU               [Active]         2.200%     │
│ Code: PAYU                        [Edit Rate]  │
└─────────────────────────────────────────────────┘
```

### Channel Rate Manager:
```
┌─────────────────────────────────────────────────┐
│ Manage Channel Rates - Razorpay           [X]  │
├─────────────────────────────────────────────────┤
│ Credit Card                                      │
│ ┌──────────────────┬──────────────────┐       │
│ │ VISA Normal      │ Master Normal    │       │
│ │ Schema: 1.5%     │ Schema: 1.5%     │       │
│ │ [0.015] = 1.50%  │ [0.015] = 1.50%  │       │
│ └──────────────────┴──────────────────┘       │
│ ┌──────────────────┬──────────────────┐       │
│ │ VISA Corporate   │ Master Corporate │       │
│ │ Schema: 2.0%     │ Schema: 2.0%     │       │
│ │ [0.025] = 2.50%  │ [0.025] = 2.50%  │       │
│ │ [Modified]       │ [Modified]       │       │
│ └──────────────────┴──────────────────┘       │
├─────────────────────────────────────────────────┤
│ You have unsaved changes    [Reset] [Cancel]   │
│                              [Save Changes]     │
└─────────────────────────────────────────────────┘
```

---

## Testing Checklist

### Admin - PG Base Rates:
- [ ] Can view all PGs with base rates
- [ ] Can edit base rate (validates 0-10%)
- [ ] Changes save successfully
- [ ] Toast notification on success/error
- [ ] Changes reflect in database
- [ ] Other users see updated rates

### MD/Admin - Channel Rates:
- [ ] Can open channel rate manager for any user
- [ ] All channels display correctly (grouped by category)
- [ ] Schema rates show correctly
- [ ] Can edit multiple channels
- [ ] Modified channels show blue badge
- [ ] Custom rates show green badge
- [ ] Validation works (can't go below min rate)
- [ ] Bulk save works
- [ ] Reset button works
- [ ] Changes reflect in transactions

---

## Troubleshooting

**Issue:** "Failed to update base rate"
- **Solution:** Check if user has Admin role, verify baseRate is between 0 and 0.1

**Issue:** "Rate cannot be below minimum"
- **Solution:** Each channel has a minimum rate (from schema or PG base), user rate must be >= that

**Issue:** Channel rates not showing
- **Solution:** Ensure PG has channels seeded in database (19 channels per PG)

**Issue:** Changes not saving
- **Solution:** Check browser console for errors, verify API endpoints are accessible

---

## Next Steps

1. ✅ APIs implemented and deployed
2. ✅ UI components created
3. ⏳ Integrate components into AdminDashboard
4. ⏳ Test on production
5. ⏳ Create user documentation/training
