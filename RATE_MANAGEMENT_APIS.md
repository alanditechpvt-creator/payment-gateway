# Rate Management API Implementation Plan

## Current Status ✅
- `PaymentGateway.baseRate` field exists in database
- `assignRate()` creates UserPayinRate for all channels
- Basic rate assignment API exists: `POST /api/rates/assign`

## Missing APIs Needed

### 1. Admin: Set PG Base Rate
```
PUT /api/pg/:pgId/base-rate
Body: { baseRate: 0.01 }
Auth: Admin only
```

### 2. MD/Dist: Get User's Channel Rates
```
GET /api/rates/user/:userId/channels/:pgId
Returns: [
  { channelId, channelName, channelCode, currentRate, minRate, schemaRate }
]
Auth: Admin, MD (if parent)
```

### 3. MD/Dist: Update Single Channel Rate
```
PUT /api/rates/user/:userId/channel/:channelId
Body: { payinRate: 0.02 }
Auth: Admin, MD (if parent)
```

### 4. MD/Dist: Bulk Update Channel Rates
```
PUT /api/rates/user/:userId/channels
Body: { 
  pgId: "xxx",
  rates: [
    { channelId: "xxx", payinRate: 0.02 },
    { channelId: "yyy", payinRate: 0.025 }
  ]
}
Auth: Admin, MD (if parent)
```

### 5. Get Available Channels for PG
```
GET /api/pg/:pgId/channels
Returns: [
  { id, name, code, category, cardNetwork, cardType, description }
]
Auth: Authenticated
```

## Implementation Steps
1. Add controller methods
2. Add service methods
3. Add routes
4. Add validation
5. Test and deploy
