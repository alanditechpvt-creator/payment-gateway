# Payment Gateway – Project Context

*Use this file to get up to speed when resuming work. Update it as you make changes.*

---

## Project overview

- **Stack:** Next.js frontend + admin app, Node/Express backend, Prisma + DB.
- **Purpose:** Payment gateway platform with hierarchy (Admin → White Label → Master Distributor → Distributor → Retailer), schemas/plans, PG assignments, payin/payout, wallet, ledger, commissions.

---

## Key areas

| Area | Location | Notes |
|------|----------|--------|
| Backend API | `backend/src` | Routes, controllers, services (auth, user, transaction, wallet, ledger, rate, schema, PG, channel rates, etc.) |
| Admin app | `admin/src` | Dashboard, users, schemas, gateways, wallet, ledger, transactions, reports, settings. Uses `adminAccessToken`. |
| Frontend app | `frontend/src` | Dashboard for non-admin users (MD/Distributor/Retailer): users, transactions, ledger, rates, wallet, settings. |
| SabPaisa PG | `backend/src/controllers/sabpaisa.controller.ts` | PG-specific callbacks and flows. |

---

## Recent changes (for tomorrow’s modifications)

1. **Ledger/commission display**
   - Payin net credit to initiator wallet is stored as ledger type **CREDIT** (not COMMISSION) when success is set via `updateTransactionStatus`. New `creditPayinNet()` in wallet service; `creditCommission()` only for hierarchy commission.

2. **Admin: transactions & ledger**
   - Admin **Transactions:** pagination (page, limit 20), “Export CSV” with ref guard.
   - Admin **Global Ledger:** already had pagination; added **Export CSV/JSON** via backend `GET /ledger/global/export`.

3. **Onboarding**
   - Frontend onboarding page restructured to match admin: single-page form with sections (Personal, Business, Tax/KYC with Aadhaar+PAN+uploads, Profile Photo, Email OTP). Same styling as admin.

4. **Frontend user profile / rates**
   - User profile and rate assignment aligned with admin where applicable; hierarchy restrictions applied.
   - When **target user has a schema:** no Payin/Payout rate inputs when assigning PG; message: “Rates are taken from the user’s schema.”
   - **Backend:** Schema-only PG assignment allowed when **target user has `schemaId`** (not only when assigner is Admin), so MD can assign PG to retailer with schema without sending rates; no “Payin rate (0.00%) cannot be lower than your base rate” error.

---

## Where to look for common tasks

- **User/role/hierarchy:** `backend/src/services/user.service.ts`, auth middleware.
- **Rates (assign, schema, channel):** `backend/src/services/rate.service.ts`, `channelRate.service.ts`; frontend `dashboard/users/[id]` (Rates tab), `dashboard/rates`.
- **Transactions:** `backend/src/services/transaction.service.ts`, `transaction.controller.ts`; frontend `dashboard/transactions`; admin Transactions tab.
- **Ledger/wallet:** `backend/src/services/ledger.service.ts`, `wallet.service.ts`; admin Global Ledger; frontend ledger.
- **PG integration (e.g. SabPaisa):** `backend/src/controllers/sabpaisa.controller.ts`, related PG services.

---

## Resuming tomorrow

1. Open this file and skim “Recent changes” and “Key areas.”
2. If you have a specific modification in mind, tell the assistant: “I’m working on the payment-gateway project; see PROJECT_CONTEXT.md. I want to …”
3. Optionally add a short “Planned modifications” section below and update it as you go.

---

## Planned modifications (optional – fill in)

- 
