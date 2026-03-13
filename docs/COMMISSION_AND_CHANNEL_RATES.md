# Commission & Channel Rate System

## Commission distribution (hierarchical)

- **Rule:** Each level earns **child's rate − my rate**.
- **Admin Base Rate:** Stored in `SystemSettings.ADMIN_BASE_RATE` (decimal, e.g. `0.01` = 1%). Admin has no “cost” from PG; this is the platform’s base. Admin earns **(immediate child’s rate − ADMIN_BASE_RATE)**.

### Examples

- **Admin Base Rate = 1%, MD rate = 1.5%**  
  - Admin earns: 1.5% − 1% = **0.5%**.

- **MD assigns Retailer at 2%**  
  - Retailer pays 2%.  
  - MD earns: 2% − 1.5% = **0.5%**.  
  - Admin earns: 1.5% − 1% = **0.5%**.

So for a ₹10,000 PAYIN at 2% (Retailer): total margin 1% (2% − 1% Admin base) = ₹100; Admin ₹50, MD ₹50.

### Configuration

- **ADMIN_BASE_RATE:** Set in Admin → Settings (or `SystemSettings` key `ADMIN_BASE_RATE`, value e.g. `0.01`). Seeded by `prisma/seed-security.ts` (default `0.01`).

---

## Rates per PG and card type (channel)

- Rates are **per payment gateway and per channel** (card type / method).
- **Channels** include: UPI, Net Banking, Debit Card, Wallet, and card networks (VISA, Master, RuPay, Amex, Diners) with types (Normal, Corporate, Premium).
- **VISA/Master Corporate (or Business)** can be given the **same rate as Amex/Diners** (e.g. premium rate); configure the same percentage for those channels in the schema.

### Where rates are set

1. **Schema (plan) level**  
   - Admin configures **Schema Payin Rates** per PG and per channel (UPI, netbanking, debit, credit_visa_normal, credit_visa_corporate, credit_master_normal, credit_amex, etc.) under **Schemas** tab (or “Configure Channel Rates” per schema).  
   - Covers: UPI, Net Banking, Debit Card, and all card types (VISA normal, VISA corporate, Master normal, RuPay, Amex, Diners, etc.).

2. **User level**  
   - MD/Admin can assign **user-level overrides** per channel (User Payin Rates) so a specific user gets a different rate than the schema default.

3. **Transaction**  
   - At payment confirmation we get the **payment method** from the PG (Razorpay/Sabpaisa/Runpaisa response). We build a **rawPaymentMethod** string, **detect the channel**, then apply the **schema/user rate for that channel** and use it for **commission** (each level’s rate is taken from the same channel).

---

## Automatic card type detection from PG response

- We build **rawPaymentMethod** from the PG response and then match it to a **TransactionChannel** (via `pgResponseCodes` or logic).

### Razorpay (verify payment / payment details)

- **Fields used:**  
  - `payment.method` → `card`, `upi`, `netbanking`, `wallet`, etc.  
  - `payment.card.network` → `visa`, `mastercard`, `rupay`, etc.  
  - `payment.card.type` → `credit`, `debit`.

- **How we build `rawPaymentMethod`:**  
  - If `method === 'card'` and we have `network`:  
    - If `type === 'debit'` → `rawPaymentMethod = 'debitcard'`.  
    - Else → `rawPaymentMethod = 'credit_<network>_<category>'` (e.g. `credit_visa_normal`, `credit_visa_corporate` if we ever get category).  
  - Else → `rawPaymentMethod = method` (e.g. `upi`, `netbanking`, `wallet`).

- **Matching to channels:**  
  - Each **TransactionChannel** has `pgResponseCodes` (JSON array of strings). We match when the stored `rawPaymentMethod` (or normalized form) is contained in or matches those codes (e.g. `upi`, `credit_visa_normal`, `debitcard`).  
  - So: VISA normal, Master normal, RuPay, UPI, Net Banking, Debit Card each have a channel and rate; VISA/Master corporate can share a rate with Amex/Diners by setting the same % for those channels in the schema.

### Runpaisa / webhook (ORDERSTATUS)

- **Fields used:**  
  - `ORDERSTATUS.TXN_MODE` → payment method.  
  - `ORDERSTATUS.CARD_TYPE` or `CARD_TYPE` → network (VISA, MASTER, UPI).  
  - `ORDERSTATUS.CARD_CATEGORY` → NORMAL, CORPORATE.

- We build a similar **rawPaymentMethod** (e.g. `credit_visa_normal`, `upi`) and pass it to the same channel-detection logic.

### Sabpaisa

- Use the same idea: from the success/callback response, read the field that indicates **method** (e.g. card/UPI/netbanking) and **card type** (e.g. VISA/Master, normal/corporate), build **rawPaymentMethod**, then detect channel.

### Testing with real PG responses

- **Razorpay:** After a test payment, call **Fetch payment details** (e.g. `GET /payments/:id`). Use the returned `method`, `card.network`, `card.type` to confirm the mapping to our channels.  
- **Runpaisa/Sabpaisa:** Trigger a test payment and inspect the callback/webhook payload; note the keys that carry method and card type (e.g. `TXN_MODE`, `CARD_TYPE`, `CARD_CATEGORY`).  
- Ensure **TransactionChannel** rows for that PG have **pgResponseCodes** that include the exact (or normalized) values we put in **rawPaymentMethod** so the correct channel and rate are applied.

---

## Summary

- **Commission:** Admin base rate from `ADMIN_BASE_RATE`; each entity earns (child rate − my rate).  
- **Rates:** Per PG and per channel (UPI, netbanking, debit, VISA normal, VISA corporate, Master, RuPay, Amex, Diners, etc.) at **schema** level; **user** overrides when needed.  
- **Card type detection:** From Razorpay/Runpaisa/Sabpaisa response → **rawPaymentMethod** → **channel** → schema/user **rate** for that channel → used for charges and **commission** at each level.
