# NBA – Technical Specification (as implemented)

**Baseline:** BASE20260518  
**Generated:** 2026-05-18 12:57:49

## 0) Scope
This is an **as-is** technical specification of the NBA algorithm implemented in `nba_engine.py` and parameterized by `nba_config.json` (schema) + trigger catalog JSON.

## 1) Component responsibilities
- **Engine (`nba_engine.py`)**: models, trigger detection, scoring, strategic category, channel selection, action generation, final NBA JSON.
- **Config (`nba_config.json` + loader)**: stores tunable parameters as a UI-friendly schema; runtime uses flattened values.
- **Trigger catalog (`trigger_catalog_base.json` + overrides)**: governance/metadata per trigger (enabled, severity, display_order, payload schema).
- **API/UI**: transport & rendering (no decision logic).

## 2) Engine structure
### 2.1 In-code classes
```text
Policy
Client
Lead
```

### 2.2 Public entrypoints
The public API of the engine is:
- `generate_client_nba(client_dict, debug=False)`
- `generate_lead_nba(lead_dict)`

## 3) Configuration (flattened view)
`nba_config.json` is stored as `{value,min,max,step}` nodes and flattened at runtime to values only.

### 3.1 client_weights
```json
{
  "urgency": 0.7,
  "value": 0.42,
  "opportunity": 0.8,
  "recency": 0.34
}
```

### 3.2 lead_weights
```json
{
  "urgency": 0.45,
  "value": 0.9,
  "timing": 0.45
}
```

### 3.3 tiers
```json
{
  "CRITICAL": 95,
  "HIGH": 80,
  "MEDIUM": 50
}
```

### 3.4 thresholds
```json
{
  "HIGH_CHURN_THRESHOLD": 0.35,
  "SINGLE_POLICY_CHURN_THRESHOLD": 0.73,
  "CHURN_OVERRIDE_RENEWAL_DAYS": 30,
  "NO_CONTACT_DAYS_THRESHOLD": 90,
  "LEAD_NEW_HOURS_THRESHOLD": 134,
  "LEAD_STALE_DAYS_THRESHOLD": 10,
  "LEAD_COVERAGE_START_SOON_DAYS": 14,
  "LEAD_HIGH_VALUE_PREMIUM_THRESHOLD": 1900,
  "OPEN_CASE_URGENCY_BOOST": 26,
  "ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST": 41,
  "VIVA_EXPIRING_OPPORTUNITY_BOOST": 20,
  "PENDING_QUOTE_OPPORTUNITY_BOOST": 36,
  "VALUE_TENURE_MAX_YEARS": 25,
  "VALUE_POLICYCOUNT_MAX": 8,
  "VALUE_AGENCY_PROFIT_MAX": 7100,
  "VALUE_COMPANY_SP_MAX": 0.6,
  "VALUE_AUTO_NORM_MAX": 3250,
  "VALUE_NONAUTO_PREM_MAX": 5000
}
```

### 3.5 avg_premiums
```json
{
  "HOME": 1500,
  "AUTO": 4150,
  "VITA": 600,
  "UPSELL": 300,
  "PET": 100
}
```

## 4) Input schemas
### 4.1 Policy
```json
{
  "policy_number": "P123456",
  "product": "AUTO",
  "premium": 850.0,
  "expiry_date": "2026-12-31",
  "churn_rate": 0.25
}
```
### 4.2 Client
```json
{
  "client_id": "C0001",
  "email": "customer@example.com",
  "phone": "3331234567",
  "preferred_channel": "PHONE",
  "whatsapp_enabled": true,

  "last_contact_days": 120,
  "birthday_days": 3,
  "anniversary_days": 10,

  "unpaid_days": [32],
  "cross_sell_gaps": ["HOME", "VITA"],

  "viva_points": 1400,
  "viva_points_expiring": 250,
  "viva_enrolled": true,
  "checkup_done": false,

  "customer_tenure_years": 12,
  "active_policies_count": 3,
  "agency_profitability": 500,
  "company_profitability_sp": 0.65,
  "auto_premium_normalized": 900,
  "auto_guarantees_weight_vct": 1.1,
  "non_auto_premium_total": 1500,

  "policies": [
    {
      "policy_number": "P100",
      "product": "AUTO",
      "premium": 900,
      "expiry_date": "2026-06-30",
      "churn_rate": 0.82
    }
  ],

  "claims": [{"status":"OPEN","opened_date":"2026-05-01","reference_id":"C-123"}],
  "complaints": null,
  "active_campaigns": [{"campaign_id":"CAMP101","name":"Promo","product_scope":"HOME","end_date":"2026-06-10"}],
  "pending_quotes": [{"quote_id":"Q9001","product":"VITA","saved_at":"2026-05-10","coverage_start_date":"2026-06-01","status":"PENDING"}]
}
```
### 4.3 Lead
```json
{
  "lead_id": "L0001",
  "product": "AUTO",
  "marketing_consent": true,

  "created_hours_ago": 6,
  "last_contact_days": null,

  "quote_premium": 900,
  "coverage_start_days": 7,

  "email": "lead@example.com",
  "phone": "3337778888",
  "preferred_channel": "EMAIL",
  "whatsapp_enabled": false
}
```

## 5) Output schema
The engine returns `None` (no NBA) or an NBA JSON object like the following:
```json
{
  "target_id": "C0001",
  "target_type": "CLIENT",
  "priority_score": 82.5,
  "priority_tier": "HIGH",
  "strategic_category": "RETENTION",
  "presentation_mode": "INLINE",
  "triggers": ["PAYMENT_OVERDUE", "RENEWAL_14D"],
  "trigger_details": {
    "PAYMENT_OVERDUE": {"max_days_overdue": 32},
    "RENEWAL_14D": {"policies": [{"policy": {"policy_number": "P100"}, "days_remaining": 12}]}
  },
  "recommended_actions": [
    {
      "action_category": "PAYMENT",
      "recommended_action": "Gestire insoluto polizza - scaduto da 32 giorni.",
      "recommended_channel": "PHONE",
      "suggest_appointment": false,
      "primary": true,
      "priority_within_task": "PRIMARY"
    },
    {
      "action_category": "RENEWAL",
      "recommended_action": "Rinnovo urgente - scadenza tra 12 giorni (900€/anno)",
      "recommended_channel": "PHONE",
      "suggest_appointment": false,
      "primary": false,
      "priority_within_task": "SECONDARY"
    }
  ]
}
```

## 6) Trigger catalog (canonical codes)
### 6.1 CLIENT triggers
```json
{
  "PAYMENT_OVERDUE": {
    "default_enabled": true,
    "display_name": "PAYMENT_OVERDUE",
    "severity": "HIGH",
    "display_order": 10,
    "payload_schema": {
      "max_days_overdue": "int"
    },
    "threshold_refs": []
  },
  "RENEWAL_7D": {
    "default_enabled": true,
    "display_name": "RENEWAL_7D",
    "severity": "HIGH",
    "display_order": 20,
    "payload_schema": {
      "policies": "Policy[]"
    },
    "threshold_refs": []
  },
  "RENEWAL_14D": {
    "default_enabled": true,
    "display_name": "RENEWAL_14D",
    "severity": "MEDIUM",
    "display_order": 21,
    "payload_schema": {
      "policies": "Policy[]"
    },
    "threshold_refs": []
  },
  "RENEWAL_30D": {
    "default_enabled": true,
    "display_name": "RENEWAL_30D",
    "severity": "MEDIUM",
    "display_order": 22,
    "payload_schema": {
      "policies": "Policy[]"
    },
    "threshold_refs": []
  },
  "RENEWAL_45D": {
    "default_enabled": true,
    "display_name": "RENEWAL_45D",
    "severity": "LOW",
    "display_order": 23,
    "payload_schema": {
      "policies": "Policy[]"
    },
    "threshold_refs": []
  },
  "MULTI_RENEWAL": {
    "default_enabled": true,
    "display_name": "MULTI_RENEWAL",
    "severity": "LOW",
    "display_order": 24,
    "payload_schema": {
      "policies": "Policy[]"
    },
    "threshold_refs": []
  },
  "HIGH_CHURN_RISK": {
    "default_enabled": true,
    "display_name": "HIGH_CHURN_RISK",
    "severity": "CRITICAL",
    "display_order": 30,
    "payload_schema": {
      "policy_number": "string",
      "product": "string",
      "churn_rate": "float"
    },
    "threshold_refs": [
      "HIGH_CHURN_THRESHOLD"
    ]
  },
  "SINGLE_POLICY_RISK": {
    "default_enabled": true,
    "display_name": "SINGLE_POLICY_RISK",
    "severity": "HIGH",
    "display_order": 31,
    "payload_schema": {
      "policy_number": "string",
      "product": "string",
      "churn_rate": "float"
    },
    "threshold_refs": [
      "SINGLE_POLICY_CHURN_THRESHOLD"
    ]
  },
  "CONTACT_OVERDUE": {
    "default_enabled": true,
    "display_name": "CONTACT_OVERDUE",
    "severity": "LOW",
    "display_order": 40,
    "payload_schema": {
      "days_since_contact": "int"
    },
    "threshold_refs": [
      "NO_CONTACT_DAYS_THRESHOLD"
    ]
  },
  "BIRTHDAY": {
    "default_enabled": true,
    "display_name": "BIRTHDAY",
    "severity": "LOW",
    "display_order": 41,
    "payload_schema": {
      "days_remaining": "int"
    },
    "threshold_refs": []
  },
  "CUSTOMER_ANNIVERSARY": {
    "default_enabled": true,
    "display_name": "CUSTOMER_ANNIVERSARY",
    "severity": "LOW",
    "display_order": 42,
    "payload_schema": {
      "days_remaining": "int"
    },
    "threshold_refs": []
  },
  "VIVA_NOT_ENROLLED": {
    "default_enabled": true,
    "display_name": "VIVA_NOT_ENROLLED",
    "severity": "LOW",
    "display_order": 50,
    "payload_schema": {
      "policy_count": "int"
    },
    "threshold_refs": []
  },
  "VIVA_POINTS_HIGH": {
    "default_enabled": true,
    "display_name": "VIVA_POINTS_HIGH",
    "severity": "LOW",
    "display_order": 51,
    "payload_schema": {
      "balance": "float"
    },
    "threshold_refs": []
  },
  "VIVA_POINTS_EXPIRING": {
    "default_enabled": true,
    "display_name": "VIVA_POINTS_EXPIRING",
    "severity": "LOW",
    "display_order": 52,
    "payload_schema": {
      "expiring_points": "int"
    },
    "threshold_refs": []
  },
  "CHECKUP_NOT_DONE": {
    "default_enabled": true,
    "display_name": "CHECKUP_NOT_DONE",
    "severity": "LOW",
    "display_order": 60,
    "payload_schema": {
      "policy_count": "int"
    },
    "threshold_refs": []
  },
  "COVERAGE_GAPS": {
    "default_enabled": true,
    "display_name": "COVERAGE_GAPS",
    "severity": "LOW",
    "display_order": 70,
    "payload_schema": {
      "gaps": "string[]"
    },
    "threshold_refs": []
  },
  "ACTIVE_CAMPAIGN": {
    "default_enabled": true,
    "display_name": "ACTIVE_CAMPAIGN",
    "severity": "LOW",
    "display_order": 71,
    "payload_schema": {
      "campaigns": "object[]"
    },
    "threshold_refs": []
  },
  "PENDING_QUOTE": {
    "default_enabled": true,
    "display_name": "PENDING_QUOTE",
    "severity": "LOW",
    "display_order": 72,
    "payload_schema": {
      "count_pending": "int",
      "nearest_coverage_start_days": "int|null",
      "oldest_saved_days": "int|null"
    },
    "threshold_refs": []
  },
  "OPEN_CLAIM": {
    "default_enabled": true,
    "display_name": "OPEN_CLAIM",
    "severity": "LOW",
    "display_order": 73,
    "payload_schema": {
      "count_open": "int"
    },
    "threshold_refs": []
  },
  "OPEN_COMPLAINT": {
    "default_enabled": true,
    "display_name": "OPEN_COMPLAINT",
    "severity": "LOW",
    "display_order": 74,
    "payload_schema": {
      "count_open": "int"
    },
    "threshold_refs": []
  },
  "SERVICE_BASELINE": {
    "default_enabled": true,
    "display_name": "SERVICE_BASELINE",
    "severity": "LOW",
    "display_order": 999,
    "payload_schema": {
      "reason": "string"
    },
    "threshold_refs": []
  }
}
```

### 6.2 LEAD triggers
```json
{
  "COVERAGE_START_SOON": {
    "default_enabled": true,
    "display_name": "COVERAGE_START_SOON",
    "severity": "HIGH",
    "display_order": 10,
    "payload_schema": {
      "days_remaining": "int"
    },
    "threshold_refs": [
      "LEAD_COVERAGE_START_SOON_DAYS"
    ]
  },
  "HIGH_VALUE_QUOTE": {
    "default_enabled": true,
    "display_name": "HIGH_VALUE_QUOTE",
    "severity": "HIGH",
    "display_order": 20,
    "payload_schema": {
      "premium": "float"
    },
    "threshold_refs": [
      "LEAD_HIGH_VALUE_PREMIUM_THRESHOLD"
    ]
  },
  "QUOTE_READY": {
    "default_enabled": true,
    "display_name": "QUOTE_READY",
    "severity": "MEDIUM",
    "display_order": 21,
    "payload_schema": {
      "premium": "float"
    },
    "threshold_refs": []
  },
  "NEW_LEAD": {
    "default_enabled": true,
    "display_name": "NEW_LEAD",
    "severity": "HIGH",
    "display_order": 30,
    "payload_schema": {
      "hours_since_creation": "int"
    },
    "threshold_refs": [
      "LEAD_NEW_HOURS_THRESHOLD"
    ]
  },
  "STALE_LEAD": {
    "default_enabled": true,
    "display_name": "STALE_LEAD",
    "severity": "MEDIUM",
    "display_order": 40,
    "payload_schema": {
      "days_since_creation": "int"
    },
    "threshold_refs": [
      "LEAD_STALE_DAYS_THRESHOLD"
    ]
  }
}
```

## 7) Trigger detection logic (as implemented)
> This section describes the **implemented** trigger families and the payload fields emitted in `trigger_details`.

### 7.1 CLIENT trigger families
- **PAYMENT_OVERDUE**: emitted when payment overdue signal is present; payload contains `max_days_overdue`.
- **RENEWAL_7D / 14D / 30D / 45D**: emitted when at least one policy expires within the window; payload includes policies and `days_remaining`.
- **MULTI_RENEWAL**: emitted when multiple policies are in renewal visibility; payload includes policies.
- **HIGH_CHURN_RISK**: emitted when any policy churn_rate >= `HIGH_CHURN_THRESHOLD`.
- **SINGLE_POLICY_RISK**: emitted when client has a single policy with churn_rate >= `SINGLE_POLICY_CHURN_THRESHOLD`.
- **CONTACT_OVERDUE**: emitted when `last_contact_days` >= `NO_CONTACT_DAYS_THRESHOLD`.
- **BIRTHDAY / CUSTOMER_ANNIVERSARY**: emitted based on proximity values (days remaining) and used also as relationship modifiers.
- **VIVA_NOT_ENROLLED / VIVA_POINTS_HIGH / VIVA_POINTS_EXPIRING**: emitted based on Viva fields and thresholds/boosts.
- **CHECKUP_NOT_DONE**: emitted when `checkup_done` is false.
- **COVERAGE_GAPS**: emitted when `cross_sell_gaps` is non-empty; payload lists gaps.
- **ACTIVE_CAMPAIGN**: emitted when `active_campaigns` is non-empty; payload includes campaigns.
- **PENDING_QUOTE**: emitted when `pending_quotes` is non-empty; payload provides count and timing indicators.
- **OPEN_CLAIM / OPEN_COMPLAINT**: emitted when claims/complaints include open items; payload contains open counts.
- **SERVICE_BASELINE**: used as default baseline when no other triggers remain and at least one action must be returned.

### 7.2 LEAD trigger families
- **COVERAGE_START_SOON**: when `coverage_start_days` <= `LEAD_COVERAGE_START_SOON_DAYS`.
- **QUOTE_READY**: when `quote_premium` is present.
- **HIGH_VALUE_QUOTE**: when `quote_premium` >= `LEAD_HIGH_VALUE_PREMIUM_THRESHOLD`.
- **NEW_LEAD**: when `created_hours_ago` <= `LEAD_NEW_HOURS_THRESHOLD`.
- **STALE_LEAD**: when (not NEW_LEAD) and `last_contact_days` is null and lead age exceeds `LEAD_STALE_DAYS_THRESHOLD` days.

## 8) Scoring
### 8.1 Tier mapping
- Tier is computed by comparing the final `priority_score` against `tiers`: CRITICAL, HIGH, MEDIUM; else LOW.

### 8.2 Client scoring model
Client score is a weighted combination of four components:
- **Urgency**: derived from retention triggers (payment/renewal/churn) and boosted by open cases (`OPEN_CASE_URGENCY_BOOST`).
- **Value**: derived from profitability/tenure/policy metrics and normalized via `VALUE_*_MAX` thresholds.
- **Opportunity**: derived from growth triggers (campaigns/viva expiring/pending quotes) and boosted by corresponding opportunity boosts.
- **Recency**: derived from last contact days (piecewise mapping).
Additional modifiers: birthday/anniversary relationship modifier; multi-trigger bonus (capped).

### 8.3 Lead scoring model
Lead score uses `lead_weights` and rule-based sub-scores for urgency/value/timing based on the active lead triggers.

## 9) Strategic category
- **Client**: RETENTION if any retention signals exist; else GROWTH if any growth signals; else SERVICE.
- **Lead**: CONVERSION when any conversion signal exists; NURTURING when stale; default CONVERSION.

## 10) Channel selection
### 10.1 Client
- If `preferred_channel` is set and available, it is used.
- Else: choose first available channel from a strategic-category-specific fallback order.
- Availability rules: PHONE requires phone; EMAIL requires email; SMS requires phone; WHATSAPP requires phone + whatsapp_enabled.

### 10.2 Lead
- Default channel is PHONE.
- If preferred_channel is present (and not PHONE) and available, it is used; else fallback order; else PHONE.

## 11) Action generation
### 11.1 Client action categories & order
Client action categories are ordered as: PAYMENT → RENEWAL → CHURN_PREVENTION → CROSS_SELL → VIVA → CHECKUP → RELATIONSHIP.

### 11.2 Primary selection
- Case management override (OPEN_CLAIM / OPEN_COMPLAINT) forces RELATIONSHIP primary.
- Churn override (policy-level check vs renewal horizon) forces CHURN_PREVENTION primary.
- Otherwise: first active category in the defined order.

### 11.3 Action text construction
Text is built by category-specific helper functions (e.g., `_cosa_payment`, `_cosa_renewal`, `_cosa_churn`, `_cosa_cross_sell`, `_cosa_viva`, `_cosa_checkup`, `_cosa_relationship`).
For growth actions, the engine may append rationale blocks based on campaigns/viva expiring/pending quotes.

### 11.4 Lead actions
Lead actions map to operational categories and messages: LEAD_CONVERSION, FIRST_CONTACT, QUOTE_FOLLOW_UP, RE_ENGAGEMENT, depending on triggers.

## 12) Trigger enable/disable (governance)
Trigger catalog metadata supports enable/disable via base+overrides; gating can filter triggers before scoring/action generation (algorithm-adjacent governance).

## Appendix A – Parameter index
### A.1 client_weights keys
- urgency, value, opportunity, recency
### A.2 lead_weights keys
- urgency, value, timing
### A.3 tiers
- CRITICAL, HIGH, MEDIUM
### A.4 avg_premiums products
- HOME, AUTO, VITA, UPSELL, PET
### A.5 thresholds
- HIGH_CHURN_THRESHOLD
- SINGLE_POLICY_CHURN_THRESHOLD
- CHURN_OVERRIDE_RENEWAL_DAYS
- NO_CONTACT_DAYS_THRESHOLD
- LEAD_NEW_HOURS_THRESHOLD
- LEAD_STALE_DAYS_THRESHOLD
- LEAD_COVERAGE_START_SOON_DAYS
- LEAD_HIGH_VALUE_PREMIUM_THRESHOLD
- OPEN_CASE_URGENCY_BOOST
- ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST
- VIVA_EXPIRING_OPPORTUNITY_BOOST
- PENDING_QUOTE_OPPORTUNITY_BOOST
- VALUE_TENURE_MAX_YEARS
- VALUE_POLICYCOUNT_MAX
- VALUE_AGENCY_PROFIT_MAX
- VALUE_COMPANY_SP_MAX
- VALUE_AUTO_NORM_MAX
- VALUE_NONAUTO_PREM_MAX
