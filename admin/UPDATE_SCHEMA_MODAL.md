# Update SchemaRatesModal - Manual Instructions

The `SchemaRatesModal` function in `admin/src/components/AdminDashboard.tsx` needs to be updated to use Transaction Channels instead of the old PG rates system.

## Current Location
- **File**: `admin/src/components/AdminDashboard.tsx`
- **Lines**: 3244-3733 (function SchemaRatesModal)

## What to Replace
The entire `SchemaRatesModal` function needs to be replaced with a new implementation.

## Replacement File
The complete new implementation is available in:
- `admin/SchemaRatesModal-NEW.tsx`

## Manual Steps

### Option 1: Using VS Code
1. Open `admin/src/components/AdminDashboard.tsx`
2. Go to line 3244 (the line starting with `function SchemaRatesModal`)
3. Select all text from line 3244 to line 3733 (the closing brace of the function, just before `export default AdminDashboard;`)
4. Delete the selected text
5. Open `admin/SchemaRatesModal-NEW.tsx`
6. Copy all content (Ctrl+A, Ctrl+C)
7. Go back to AdminDashboard.tsx at the position where you deleted  
8. Paste the new function (Ctrl+V)
9. Save the file (Ctrl+S)

### Option 2: Using PowerShell (Automated)
Run this command from the `admin` directory:

```powershell
# Backup first
Copy-Item "src\components\AdminDashboard.tsx" "src\components\AdminDashboard.tsx.backup"

# Read the file
$content = Get-Content "src\components\AdminDashboard.tsx" -Raw

# Find the pattern to replace (between function SchemaRatesModal and the closing })
# This is complex, so manual replacement is recommended

# Or use a text editor with regex support
```

## Key Changes in New Implementation

### 1. New State Variables
- `view`: 'pg-list' | 'channels' | 'payout' (three-level navigation)
- `editingChannel`: Currently editing channel
- `channelRateInput`: Input value for channel rate

### 2. New API Queries
- Fetches channels per PG from `/api/admin/channels?pgId=xxx`
- Fetches schema payin rates from `/api/admin/channels/schemas/:schemaId/payin-rates`
- Fetches payout config from `/api/admin/channels/schemas/:schemaId/payout-config/:pgId`

### 3. New Mutations
- `setRateMutation`: Sets payin rate for a specific channel
- `setPayoutMutation`: Sets payout configuration for a PG

### 4. New UI Flow
1. **PG List View** - Shows all PGs with two buttons each:
   - PAYIN Channels button (shows configured/total count)
   - PAYOUT Config button
   
2. **Channels View** - Shows all payin channels for selected PG:
   - Grouped by category (UPI, Cards, Wallets, etc.)
   - Each channel shows current rate or "Not Set"
   - Click edit icon to set/change rate
   
3. **Payout View** - Configure payout for selected PG:
   - Choose percentage or slab-based
   - Configure slabs if slab-based

### 5. Removed Features
- Old `openPGEditor` function (no longer needed)
- Old `handleSaveRate` and `handleSavePayoutSlabs` functions
- References to `schema.pgRates` (uses `schemaRatesData.rates` instead)
- Single payin rate per PG (now individual rate per channel)

## Testing After Update

1. Restart admin server: `cd admin && npm run dev`
2. Login to admin panel
3. Go to Schemas tab
4. Click "Rates" button on a schema
5. You should see list of PGs with PAYIN/PAYOUT buttons
6. Click "PAYIN Channels" on Razorpay
7. You should see categories with channels (UPI, Cards, etc.)
8. Click edit icon on a channel
9. Set a rate (e.g., 2.5 for UPI)
10. Click Save - should see success message
11. Go back and click "PAYOUT Config"
12. Configure payout slabs
13. Save and verify

## Troubleshooting

### If you see compilation errors:
- Make sure all imports are present at top of file
- Required: `useQuery`, `useMutation`, `useQueryClient`, `toast`, `motion`
- Required icons: `XMarkIcon`, `ArrowLeftIcon`, `PencilIcon`, `PlusIcon`

### If API calls fail:
- Verify backend is running on port 4100
- Check that channel admin routes are registered
- Check browser console for error messages
- Verify admin is logged in (credentials: admin@newweb.com / Admin@123456)

### If channels don't load:
- Run seed script: `npm run seed` in backend directory
- Check database has TransactionChannel records
- Verify PG IDs match between PaymentGateway and TransactionChannel tables

## Files Modified
- `admin/src/components/AdminDashboard.tsx` - Updated SchemaRatesModal function

## Files Created
- `admin/SchemaRatesModal-NEW.tsx` - New implementation reference
- `admin/UPDATE_SCHEMA_MODAL.md` - This guide

## API Endpoints Used
- `GET /api/admin/channels?pgId=xxx` - List channels for a PG
- `GET /api/admin/channels/schemas/:schemaId/payin-rates` - Get schema payin rates
- `POST /api/admin/channels/schemas/:schemaId/payin-rates` - Set channel payin rate
- `GET /api/admin/channels/schemas/:schemaId/payout-config/:pgId` - Get payout config
- `POST /api/admin/channels/schemas/:schemaId/payout-config` - Set payout config

## Next Steps After Update
1. Test rate configuration for all channels
2. Verify rates are saved to database
3. Update schema card to show "Channel Rates" count instead of "PG Rates"
4. Add visual feedback for which channels have custom rates
5. Consider adding bulk rate assignment feature
