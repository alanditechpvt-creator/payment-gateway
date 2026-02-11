# Transaction Channel API Documentation

## Overview
Complete API documentation for the new channel-based rate system.

## Base URL
```
http://localhost:4100/api
```

## Authentication
All endpoints require JWT authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Admin Channel Management APIs

### 1. List All Channels
**GET** `/admin/channels`

**Query Parameters:**
- `pgId` (optional): Filter by payment gateway ID
- `transactionType` (optional): Filter by type (PAYIN or PAYOUT)
- `category` (optional): Filter by category (UPI, CARD, WALLET, etc.)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "razorpay_upi",
      "name": "UPI",
      "category": "UPI",
      "transactionType": "PAYIN",
      "baseCost": 0.015,
      "pgResponseCodes": "[\"upi\", \"UPI\"]",
      "isDefault": false,
      "isActive": true,
      "isCustom": false,
      "paymentGateway": {
        "id": "uuid",
        "name": "Razorpay",
        "code": "RAZORPAY"
      },
      "_count": {
        "schemaPayinRates": 3,
        "userPayinRates": 5,
        "transactions": 120
      }
    }
  ]
}
```

### 2. Get Single Channel
**GET** `/admin/channels/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "razorpay_upi",
    "name": "UPI",
    "category": "UPI",
    "transactionType": "PAYIN",
    "baseCost": 0.015,
    "paymentGateway": { ... },
    "schemaPayinRates": [
      {
        "id": "uuid",
        "schemaId": "uuid",
        "payinRate": 0.015,
        "isEnabled": true,
        "schema": {
          "name": "Platinum",
          "code": "PLATINUM"
        }
      }
    ],
    "userPayinRates": [ ... ],
    "_count": {
      "transactions": 120
    }
  }
}
```

### 3. Create Channel
**POST** `/admin/channels`

**Request Body:**
```json
{
  "pgId": "uuid",
  "code": "custom_wallet",
  "name": "Custom Wallet",
  "category": "WALLET",
  "transactionType": "PAYIN",
  "cardNetwork": null,
  "cardType": null,
  "baseCost": 0.018,
  "pgResponseCodes": ["paytm", "phonepay", "googlepay"],
  "isDefault": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Channel created successfully",
  "data": { ... }
}
```

### 4. Update Channel
**PUT** `/admin/channels/:id`

**Request Body:**
```json
{
  "name": "Updated Name",
  "baseCost": 0.020,
  "pgResponseCodes": ["paytm", "phonepay"],
  "isActive": false
}
```

### 5. Delete Channel
**DELETE** `/admin/channels/:id`

**Response:**
```json
{
  "success": true,
  "message": "Channel deleted successfully"
}
```

**Note:** Can only delete custom channels with no transactions.

---

## Schema Rate Management APIs

### 6. Get Schema Payin Rates
**GET** `/admin/channels/schemas/:schemaId/payin-rates`

**Response:**
```json
{
  "success": true,
  "data": {
    "schema": {
      "id": "uuid",
      "name": "Platinum",
      "code": "PLATINUM"
    },
    "ratesByPG": {
      "RAZORPAY": {
        "paymentGateway": { ... },
        "rates": [
          {
            "id": "uuid",
            "channelId": "uuid",
            "channelCode": "razorpay_upi",
            "channelName": "UPI",
            "channelCategory": "UPI",
            "payinRate": 0.015,
            "payinRateDisplay": "1.50%",
            "isEnabled": true
          }
        ]
      }
    }
  }
}
```

### 7. Set Schema Payin Rate
**POST** `/admin/channels/schemas/:schemaId/payin-rates`

**Request Body:**
```json
{
  "channelId": "uuid",
  "payinRate": 0.020,
  "isEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payin rate set successfully",
  "data": { ... }
}
```

### 8. Get Schema Payout Config
**GET** `/admin/channels/schemas/:schemaId/payout-config`

**Response:**
```json
{
  "success": true,
  "data": {
    "schema": { ... },
    "config": {
      "id": "uuid",
      "schemaId": "uuid",
      "pgId": "uuid",
      "paymentGateway": { ... },
      "slabs": [
        {
          "id": "uuid",
          "minAmount": 5000,
          "maxAmount": 50000,
          "flatCharge": 10
        },
        {
          "id": "uuid",
          "minAmount": 50001,
          "maxAmount": 100000,
          "flatCharge": 15
        }
      ]
    }
  }
}
```

### 9. Set Schema Payout Config
**POST** `/admin/channels/schemas/:schemaId/payout-config`

**Request Body:**
```json
{
  "pgId": "uuid",
  "slabs": [
    {
      "minAmount": 5000,
      "maxAmount": 50000,
      "flatCharge": 10
    },
    {
      "minAmount": 50001,
      "maxAmount": 100000,
      "flatCharge": 15
    },
    {
      "minAmount": 100001,
      "maxAmount": null,
      "flatCharge": 20
    }
  ]
}
```

### 10. Get Channel Statistics
**GET** `/admin/channels/statistics`

**Query Parameters:**
- `pgId` (optional): Filter by PG
- `days` (optional): Number of days (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "Last 30 days",
    "statistics": [
      {
        "channelId": "uuid",
        "type": "PAYIN",
        "status": "SUCCESS",
        "_count": 150,
        "_sum": {
          "amount": 450000,
          "pgCharges": 6750
        },
        "channel": {
          "code": "razorpay_upi",
          "name": "UPI",
          "category": "UPI",
          "paymentGateway": { ... }
        }
      }
    ]
  }
}
```

---

## User Rate Management APIs (MD Only)

### 11. Get User Rates
**GET** `/user-rates/:userId/rates`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "USER",
      "schema": {
        "name": "Gold",
        "code": "GOLD"
      }
    },
    "payinRates": {
      "RAZORPAY": {
        "paymentGateway": { ... },
        "rates": [
          {
            "channelCode": "razorpay_upi",
            "channelName": "UPI",
            "schemaRate": 0.0165,
            "userRate": 0.0180,
            "effectiveRate": 0.0180,
            "isUserOverride": true
          }
        ]
      }
    },
    "payoutConfig": {
      "type": "schema",
      "slabs": [ ... ]
    }
  }
}
```

### 12. Get Available Channels
**GET** `/user-rates/:userId/available-channels?transactionType=PAYIN`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "channelId": "uuid",
      "channelCode": "razorpay_upi",
      "channelName": "UPI",
      "category": "UPI",
      "pgName": "Razorpay",
      "schemaRate": 0.0165,
      "userRate": null,
      "effectiveRate": 0.0165
    }
  ]
}
```

### 13. Assign User Payin Rate
**POST** `/user-rates/:userId/payin-rates`

**Request Body:**
```json
{
  "channelId": "uuid",
  "customRate": 0.0180
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payin rate assigned successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "channelId": "uuid",
    "customRate": 0.0180,
    "isEnabled": true,
    "assignedById": "uuid",
    "createdAt": "2026-02-08T..."
  }
}
```

### 14. Update User Payin Rate
**PUT** `/user-rates/:userId/payin-rates/:rateId`

**Request Body:**
```json
{
  "customRate": 0.0200,
  "isEnabled": true
}
```

### 15. Remove User Payin Rate
**DELETE** `/user-rates/:userId/payin-rates/:rateId`

**Response:**
```json
{
  "success": true,
  "message": "Payin rate removed successfully. User will now use schema rate."
}
```

### 16. Assign User Payout Rate
**POST** `/user-rates/:userId/payout-rate`

**Request Body:**
```json
{
  "pgId": "uuid",
  "slabs": [
    {
      "minAmount": 5000,
      "maxAmount": 50000,
      "flatCharge": 12
    },
    {
      "minAmount": 50001,
      "maxAmount": 100000,
      "flatCharge": 18
    },
    {
      "minAmount": 100001,
      "maxAmount": null,
      "flatCharge": 25
    }
  ]
}
```

### 17. Remove User Payout Rate
**DELETE** `/user-rates/:userId/payout-rate`

### 18. Bulk Assign Payin Rates
**POST** `/user-rates/bulk-assign-payin-rates`

**Request Body:**
```json
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "channelId": "uuid",
  "customRate": 0.0180
}
```

**Response:**
```json
{
  "success": true,
  "message": "Assigned rates to 3 users",
  "data": {
    "successful": [
      { "userId": "uuid1", "success": true, "data": { ... } }
    ],
    "failed": [
      { "userId": "uuid2", "success": false, "error": "..." }
    ]
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (in development only)"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Authorization Matrix

| Endpoint | Admin | MD | User |
|----------|-------|-----|------|
| Admin Channel APIs | ✓ | ✗ | ✗ |
| Schema Rate APIs | ✓ | ✗ | ✗ |
| Get User Rates | ✓ | ✓ | ✗ |
| Assign User Rates | ✓ | ✓ | ✗ |
| View Own Rates | ✓ | ✓ | ✓ |

---

## Usage Examples

### Example 1: Create Custom Channel
```bash
curl -X POST http://localhost:4100/api/admin/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pgId": "bb2c0e25-ed64-4e75-998c-dbdea2ea4a43",
    "code": "razorpay_bhim_upi",
    "name": "BHIM UPI",
    "category": "UPI",
    "transactionType": "PAYIN",
    "baseCost": 0.012,
    "pgResponseCodes": ["bhim", "BHIM"],
    "isDefault": false
  }'
```

### Example 2: Set Schema Rate
```bash
curl -X POST http://localhost:4100/api/admin/channels/schemas/d6dd8984.../payin-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "channel-uuid",
    "payinRate": 0.018,
    "isEnabled": true
  }'
```

### Example 3: Assign User Custom Rate
```bash
curl -X POST http://localhost:4100/api/user-rates/user-uuid/payin-rates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "channel-uuid",
    "customRate": 0.020
  }'
```

### Example 4: Set Payout Slabs
```bash
curl -X POST http://localhost:4100/api/admin/channels/schemas/schema-uuid/payout-config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pgId": "pg-uuid",
    "slabs": [
      {"minAmount": 5000, "maxAmount": 50000, "flatCharge": 10},
      {"minAmount": 50001, "maxAmount": 100000, "flatCharge": 15},
      {"minAmount": 100001, "maxAmount": null, "flatCharge": 20}
    ]
  }'
```

---

## Testing Checklist

- [ ] List all channels
- [ ] Create custom channel
- [ ] Update channel
- [ ] Get schema payin rates
- [ ] Set schema payin rate
- [ ] Get schema payout config
- [ ] Set schema payout slabs
- [ ] Get user rates
- [ ] Assign user payin rate
- [ ] Assign user payout rate
- [ ] Bulk assign rates
- [ ] View channel statistics
- [ ] Test authorization (Admin vs MD vs User)
