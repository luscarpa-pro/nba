# JSON Record Schema — Client and Lead

> This document specifies the JSON format expected by the NBA engine for **Client** and **Lead** records.
> All dates must be ISO format: `YYYY-MM-DD`.

---

## 1) Client Record (JSON)

### 1.1 Top-level fields

**Required**
- `client_id` (string)
- `policies` (array of Policy objects) — may be empty but typically 1+

**Contactability (at least one recommended)**
- `phone` (string | null)
- `email` (string | null)

If both `phone` and `email` are null/empty, the engine may return no NBA.

### 1.2 Preference and channel availability
- `preferred_channel` (string | null) — one of: `PHONE | EMAIL | SMS | WHATSAPP`
- `whatsapp_enabled` (boolean | null)

Rules:
- SMS available if `phone` exists.
- WhatsApp available if `phone` exists AND `whatsapp_enabled=true`.

### 1.3 Relationship / contact
- `last_contact_days` (int | null)
- `birthday_days` (int | null) — 0..7
- `anniversary_days` (int | null) — 0..30

### 1.4 Payments / portfolio
- `unpaid_days` (array[int]) — e.g., `[32]` or `[]`
- `cross_sell_gaps` (array[string]) — allowed values: `HOME, AUTO, VITA, PET, UPSELL`
- `policies` (array[Policy])

### 1.5 Engagement / Viva
- `viva_points` (number | null)
- `viva_points_expiring` (int | null)
- `viva_enrolled` (boolean | null)
- `checkup_done` (boolean | null)

### 1.6 Claims / Complaints
- `claims` (array[Case] | null)
- `complaints` (array[Case] | null)

Open case definition:
- A case is open if `status != "CLOSED"`.

### 1.7 Advanced opportunity
- `active_campaigns` (array[Campaign] | null)
- `pending_quotes` (array[PendingQuote] | null)

### 1.8 Value drivers
All optional (missing ignored):
- `customer_tenure_years` (number | null)
- `active_policies_count` (int | null)
- `agency_profitability` (number | null)
- `company_profitability_sp` (number | null)
- `auto_premium_normalized` (number | null)
- `auto_guarantees_weight_vct` (number | null)
- `non_auto_premium_total` (number | null)

---

## 2) Sub-objects

### 2.1 Policy
```json
{
  "policy_number": "P123",
  "product": "AUTO",
  "premium": 950,
  "expiry_date": "2026-12-31",
  "churn_rate": 0.75
}
```
- `product` is free-form but typical values are: `AUTO, CASA, VITA, PET`.

### 2.2 Case (Claim / Complaint)
```json
{
  "status": "OPEN",
  "opened_date": "2026-04-10",
  "reference_id": "C-123456"
}
```
- `status` is compared case-insensitively to `CLOSED`.

### 2.3 Campaign
```json
{
  "campaign_id": "CAMP123",
  "name": "Campagna Casa Primavera",
  "product_scope": "CASA",
  "end_date": "2026-06-30"
}
```

### 2.4 PendingQuote
```json
{
  "quote_id": "Q1234",
  "product": "CASA",
  "saved_at": "2026-05-01",
  "coverage_start_date": "2026-05-15",
  "status": "PENDING"
}
```

---

## 3) Lead Record (JSON)

### 3.1 Top-level fields

**Required**
- `lead_id` (string)
- `product` (string)
- `created_hours_ago` (int)
- `marketing_consent` (boolean)

**Optional**
- `last_contact_days` (int | null)
- `quote_premium` (number | null)
- `coverage_start_days` (int | null)

### 3.2 Channel fields
- `phone` (string | null)
- `email` (string | null)
- `preferred_channel` (string | null) — same enum as client
- `whatsapp_enabled` (boolean | null)

Policy (L2):
- Default channel is PHONE.
- If `preferred_channel` is set and not PHONE, try it then fallback.

---

## 4) Minimal Examples

### 4.1 Minimal client
```json
{
  "client_id": "C001",
  "phone": "3331234567",
  "email": null,
  "policies": []
}
```

### 4.2 Typical client
```json
{
  "client_id": "C002",
  "email": "cliente2@email.it",
  "phone": "3331112222",
  "preferred_channel": "WHATSAPP",
  "whatsapp_enabled": true,
  "last_contact_days": 120,
  "unpaid_days": [32],
  "cross_sell_gaps": ["HOME","VITA"],
  "viva_points": 900,
  "viva_points_expiring": 250,
  "policies": [
    {"policy_number":"P1","product":"CASA","premium":1800,"expiry_date":"2026-12-31","churn_rate":0.81}
  ],
  "claims": [{"status":"OPEN","opened_date":"2026-04-01","reference_id":"C-100001"}],
  "active_campaigns": [{"campaign_id":"CAMP123","name":"Campagna Casa Primavera","product_scope":"CASA","end_date":"2026-06-30"}],
  "pending_quotes": [{"quote_id":"Q1234","product":"CASA","saved_at":"2026-05-01","coverage_start_date":"2026-05-15","status":"PENDING"}]
}
```

### 4.3 Minimal lead
```json
{
  "lead_id": "L001",
  "product": "AUTO",
  "created_hours_ago": 6,
  "marketing_consent": true
}
```

---

*End of schema.*
