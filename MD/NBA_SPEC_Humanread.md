# NBA Algorithm — Full Commented Specification (Deterministic, Human-Readable)

> **Purpose of this file:** provide a *human-readable* specification that can be used as a durable reference to rebuild the solution (engine, API, UI) and to explain the algorithm to business and technical stakeholders.
>
> **Nature of the algorithm:** deterministic, rule-based, configurable (weights/thresholds), auditable through explicit triggers.
>
> This spec consolidates the baseline deterministic spec and the later qualitative revision introducing the 4-phase decision process, strategic categories, and UI presentation concepts. citeturn30search1turn1search1

---

## 1. Purpose and Scope

This specification is written for **humans first**: it explains *why* each component exists, what problem it solves, and what assumptions it makes.

### 1.1 Why Next Best Action (NBA)
Operators (agents/back-office) face many possible actions at any moment. NBA reduces cognitive load by surfacing the few actions that:
- protect value (retention, service recovery)
- unlock value (growth opportunities)
- do so without being intrusive or counterproductive

### 1.2 Why deterministic (rule-based)
Determinism is a design choice that supports:
- **auditability**: you can reconstruct “why this action” from the same inputs
- **testability**: a known input yields a stable output; regression testing is straightforward
- **governance**: thresholds and weights can be reviewed and approved

### 1.3 What is in scope
- Decisioning: scores, triggers, strategic category, action list, channels, presentation hints
- Explainability: triggers and operator-facing rationale

### 1.4 What is out of scope
- CRM workflows (task assignment, SLA, ticket lifecycle)
- Customer-facing copy generation
- ML model training (no learning loop here)

---

## 2. Decision Process (4 Phases)

The revised spec organizes the NBA decision into **four sequential phases**. This structure is also a governance tool: each phase can evolve independently. citeturn30search1

### Phase 1 — Understand the situation (scoring)
**Question answered:** *“How important is it to act now?”*

Phase 1 computes partial scores (dimensions) and merges them into:
- `priority_score` (0..100)
- `priority_tier` (`LOW | MEDIUM | HIGH | CRITICAL`)

Why partial scores:
- They keep the model explainable: “urgent because renewal is soon” is distinct from “valuable customer”.
- They allow controlled trade-offs.

Dimensions:
- **Clients**: Urgency, Customer Value, Opportunity, Contact Recency citeturn30search1turn1search1
- **Leads**: Urgency, Value, Follow-up Timing citeturn30search1turn1search1

### Phase 2 — Define the strategic objective (strategic category)
**Question answered:** *“What is the objective of this interaction?”*

Strategic categories:
- Client: `RETENTION | GROWTH | SERVICE` citeturn30search1
- Lead: `CONVERSION | NURTURING` citeturn30search1

This phase is where **business overrides** live (absolute priority rules). For example, high churn or open service issues must force retention intent.

### Phase 3 — Choose the concrete action
**Question answered:** *“What should the operator concretely do?”*

Phase 3 produces one or more actions. Each action contains:
- **COSA**: what to do (operator instruction)
- **COME**: recommended channel + whether to suggest an appointment
- Primary/secondary classification inside the task

### Phase 4 — Present it in the right way (UI presentation)
**Question answered:** *“How should we show this so it helps rather than distracts?”*

Presentation modes:
- `WIDGET`, `SIDE_PANEL`, `TOAST`, `INLINE` citeturn30search1

Non-invasiveness guardrail:
- If `priority_tier == LOW` → always `INLINE` (even if a policy table would say otherwise). citeturn30search1

---

## 3. Inputs and Outputs (High-Level)

### 3.1 Inputs
- A **Client JSON record** or a **Lead JSON record** (see `JSON_SCHEMA.md`).
- A numeric configuration (weights/thresholds) from `nba_config.json`.
- Optional UI context: `source_page` (used for UI presentation policies).

### 3.2 Output (Task object)
For both Client and Lead, the algorithm returns a task-like JSON:
- `target_id`, `target_type`
- `priority_score`, `priority_tier`
- `strategic_category`
- `presentation_mode`
- `triggers[]` (audit trail)
- `recommended_actions[]`

---

## 4. Client NBA — Phase 1 Scoring

Phase 1 produces a single `priority_score` by combining partial perspectives. The goal is a **stable and monotonic** model:
- stronger signals should not reduce the score
- adding value (more premium/policies) should not reduce value score

### 4.1 Urgency (Client)
**Urgenza** is about time sensitivity and risk of damage.

Typical urgency questions:
- Is there a hard deadline approaching? (renewal windows)
- Is there an unpaid debt escalating? (payment overdue)
- Is there an open service problem that may increase dissatisfaction? (claims/complaints)
- Is the customer likely to leave? (churn risk)

Key signals:
- Payment overdue (highest precedence)
- Renewals in next 45 days, with urgency increasing as days decrease citeturn30search1turn1search1
- High churn risk (urgency + retention pressure) citeturn30search1turn1search1
- **Open claim/complaint** increases urgency with higher-than-normal weight citeturn30search1

### 4.2 Customer Value (Client)
**Valore cliente** is long-term importance.

Baseline (premium-centric):
- portfolio premium tiering
- churn-weighted multiplier
- single-policy floor citeturn1search1

Revision adds drivers:
- tenure (years)
- # active policies
- agency profitability
- company profitability (prospective S/P)
- auto premium normalized vs area + VCT weight
- non-auto premium total citeturn30search1

Design decisions:
- include all drivers (V1=TUTTI)
- keep churn multiplier in value (V2-A) but apply only to premium-based component (C1)
- auto normalized replaces raw auto contribution in value (V3-A)
- missing driver fields are ignored (M1)
- `value_breakdown` only for debug/test (E1)

Interpretation note:
- churn is also a retention signal; keeping it in value means “losing this customer is costly”.

### 4.3 Opportunity (Client)
**Opportunità** is upside potential of acting.

Baseline:
- coverage gaps weighted by `avg_premiums` citeturn1search1

Revision adds strong levers:
- active campaigns (strong boost, visible in rationale) citeturn30search1
- Viva points expiring (amplified vs simply available) citeturn30search1
- pending quote/draft for existing client (intent already shown) citeturn30search1

Decision mapping:
- campaigns trigger is unified (CA1)
- Viva expiring uses `viva_points_expiring > 0` (VP1)
- pending quotes generate trigger + rationale only (PQ1)

### 4.4 Contact Recency (Client)
Recency is an anti-spam/anti-harassment control.
- If last contact was recent, avoid pushing more contact.
- If contact is old, it can increase attention (within reason).

Recency can be disabled if contact tracking is not reliable; however, the default model includes it as a dimension. citeturn30search1turn1search1

### 4.5 Final Client Priority Score
The final score is a weighted combination of dimensions plus modifiers:
- weights from `client_weights`
- relationship modifier (birthday/anniversary)
- multi-trigger bonus

Score is mapped to tier thresholds (`tiers`).

---

## 5. Client NBA — Phase 2 Strategic Category

Strategic categories bridge scores and actions.

### 5.1 RETENTION
Applies when there is risk or an open problem:
- payment overdue
- renewal approaching
- churn risk
- claim/complaint open

### 5.2 GROWTH
Applies when there are commercial opportunities:
- coverage gaps
- campaigns
- Viva points (esp. expiring)
- pending quote
- checkup not done

### 5.3 SERVICE
Ordinary maintenance when there are no strong signals.

### 5.4 Retention-first policy (explicit)
- Retention always dominates Growth.
- If high churn risk exists: suppress Growth actions (avoid upsetting the customer).
- Otherwise, keep Growth actions but mark them `SECONDARY`.

### 5.5 Service baseline task
Service must still generate a task:
- add technical trigger `SERVICE_BASELINE`
- use `RELATIONSHIP` action category with explicit “ordinary action” message.

---

## 6. Client NBA — Phase 3 Actions

### 6.1 Action schema
Each action has:
- `action_category`
- `recommended_action` (COSA)
- `recommended_channel`
- `suggest_appointment`
- `primary` boolean
- `priority_within_task` (`PRIMARY|SECONDARY`)

### 6.2 Ordering rule
PRIMARY actions must appear **first** in the returned list and in UI rendering.

### 6.3 Primary selection with overrides
Primary is determined by precedence *unless* an override applies:

**Override A — Open cases:**
- If `OPEN_CLAIM` or `OPEN_COMPLAINT` is present, the **case-management** action must be PRIMARY.
- Represented with `action_category=RELATIONSHIP` and dedicated case text.
- If both claim and complaint open → combined text.

**Override B — Churn override:**
- High churn + renewal within `CHURN_OVERRIDE_RENEWAL_DAYS` forces critical handling and CHURN_PREVENTION primary if no open cases.

### 6.4 Secondary actions
All non-primary actions:
- `priority_within_task=SECONDARY`
- may be suppressed in the high-churn scenario if they are Growth.

### 6.5 Growth rationale enrichment
When Growth is present, enrich operator text with:
- campaign name (if any)
- Viva points expiring (if any)
- pending quote summary (if any)

---

## 7. Client NBA — Phase 4 Presentation Mode

### 7.1 Task-level presentation mode
Presentation is computed **per task** (not per action).

### 7.2 Policy table (optional)
A future policy table may map:
- `source_page × strategic_category × primary_action_category → presentation_mode` citeturn30search1

### 7.3 Defaults
- If tier is LOW → INLINE
- If policy does not match → INLINE

---

## 8. Lead NBA — Scoring, Strategy, Actions

Leads differ because there is no existing relationship to protect.

### 8.1 Scoring dimensions
- Urgency: new lead, stale lead, coverage soon
- Value: quote premium
- Timing: last contact days citeturn30search1turn1search1

### 8.2 Strategic categories
- `CONVERSION`: includes most operational lead actions (close ASAP)
- `NURTURING`: reserved for re-engagement of stale leads
- `CONVERSION` prevails over `NURTURING`

### 8.3 Lead channel policy (conservative)
- default to PHONE
- only deviate if `preferred_channel` is explicitly provided and not PHONE

---

## 9. Channel Selection (Client + Lead)

Channel selection is a three-step reasoning chain:
1) **Preference**: try `preferred_channel` first.
2) **Availability**: ensure channel is actually usable.
3) **Fallback**: if not available, use a strategic-category fallback order.

Availability rules:
- SMS available if `phone` exists.
- WhatsApp available if `phone` exists and `whatsapp_enabled=true`.

---

## 10. Determinism, Auditability, Guardrails

- Deterministic output for identical inputs/config.
- Always output `triggers[]` for audit.
- Validate config ranges; normalize weights.
- Keep action taxonomy stable; represent new semantics via triggers and strategy fields.

---

## 11. Acceptance Criteria (Summary)

- No triggers ⇒ Service baseline task exists.
- High churn ⇒ Growth actions suppressed.
- Open claim/complaint ⇒ case-management action PRIMARY.
- PRIMARY first ordering in actions list.
- presentation_mode defaults INLINE; LOW tier always INLINE.

---

## 12. Examples (5 Scenarios)

> These scenarios are **illustrative**. They help humans understand how phases interact (scoring → strategy → actions → channels → presentation). They do not introduce new rules.

### Scenario 1 — High churn + renewal soon (Retention dominates, Growth suppressed)

**Input (client snapshot)**
- One policy in renewal window (e.g., expiry within ~2 weeks)
- High churn risk present on that policy
- Some Growth opportunity exists (coverage gaps / campaign), but churn is high

**Phase 1 (Scoring intuition)**
- Urgency: high (renewal soon + churn risk)
- Value: can be medium/high depending on premium; churn multiplier increases premium-based value
- Opportunity: may exist, but does not change the retention-first objective

**Phase 2 (Strategy)**
- `strategic_category = RETENTION`

**Phase 3 (Actions)**
- PRIMARY action: `CHURN_PREVENTION` (or renewal-related retention handling depending on churn override)
- **Growth actions are suppressed** because churn is high

**Channel**
- Use `preferred_channel` if available; otherwise apply RETENTION fallback

**Presentation (Phase 4)**
- Defaults to INLINE; LOW-tier enforces INLINE

### Scenario 2 — Open claim and open complaint (Case management forced PRIMARY)

**Input (client snapshot)**
- `claims[]` contains at least one case with `status != CLOSED`
- `complaints[]` contains at least one case with `status != CLOSED`
- Other signals may exist, but open cases exist

**Phase 1 (Scoring intuition)**
- Urgency: boosted above normal due to open cases

**Phase 2 (Strategy)**
- `strategic_category = RETENTION`

**Phase 3 (Actions)**
- PRIMARY action is forced to case management, represented as `RELATIONSHIP`
- Text is **combined**: “Sinistro e reclamo aperti…”
- Growth actions remain SECONDARY (unless suppressed by high churn)

**Channel**
- Preferred channel first; WhatsApp requires `whatsapp_enabled=true`

**Presentation (Phase 4)**
- Defaults to INLINE

### Scenario 3 — No strong signals (Service baseline task)

**Input (client snapshot)**
- No retention signals (payment/renewal/churn/cases)
- No growth signals (gaps/campaigns/viva expiring/pending quote)
- No relationship triggers

**Phase 2 (Strategy)**
- `strategic_category = SERVICE`
- Technical trigger `SERVICE_BASELINE` ensures a task exists

**Phase 3 (Actions)**
- Exactly one action:
  - `action_category = RELATIONSHIP`
  - PRIMARY
  - Text: “ordinary action; no specific attention required”

**Channel**
- If client prefers SMS/WhatsApp and available, choose it; else fallback

**Presentation (Phase 4)**
- LOW-tier ⇒ INLINE

### Scenario 4 — Growth: campaign + Viva expiring + pending quote

**Input (client snapshot)**
- No retention signals
- Growth signals:
  - `ACTIVE_CAMPAIGN` present
  - `VIVA_POINTS_EXPIRING > 0`
  - `PENDING_QUOTE` present

**Phase 2 (Strategy)**
- `strategic_category = GROWTH`

**Phase 3 (Actions)**
- PRIMARY comes from an opportunity-driven category (e.g., CROSS_SELL/VIVA/CHECKUP)
- `recommended_action` is enriched with “leverage blocks”:
  - campaign name
  - expiring Viva points
  - pending quote summary

**Channel**
- Preferred channel dominates; fallback if not available

**Presentation (Phase 4)**
- Defaults to INLINE

### Scenario 5 — Lead: new lead + quote, preferred channel EMAIL (L2 exception)

**Input (lead snapshot)**
- `created_hours_ago` within NEW_LEAD threshold
- `quote_premium` present
- `preferred_channel = EMAIL`
- `marketing_consent = true`

**Phase 2 (Strategy)**
- `strategic_category = CONVERSION` (conversion prevails)

**Phase 3 (Actions)**
- Actions can include `FIRST_CONTACT` and/or `QUOTE_FOLLOW_UP` (and `LEAD_CONVERSION` if coverage soon)
- PRIMARY is the earliest in lead precedence

**Channel**
- Lead policy L2:
  - default PHONE
  - exception: preferred_channel set and not PHONE ⇒ try EMAIL first; fallback to PHONE if email missing

**Presentation (Phase 4)**
- Defaults to INLINE

---

*End of NBA_SPEC.md.*