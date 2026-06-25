"""
------------------------------------------------------------------------------------------------------------
LICENSE NOTE

This file is part of the NBA engine project, developed for Vittoria Assicurazioni spa. It is provided under 
a proprietary license and is intended for internal use only. 
Unauthorized distribution, reproduction, or use of this code is strictly prohibited. 
For inquiries about licensing or usage, please contact the project maintainers at Vittoria Assicurazioni spa.
------------------------------------------------------------------------------------------------------------
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Tuple, Set

from nba_config import get_config


# ============================================================
# Helpers / guardrails
# ============================================================

def _clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    try:
        x = float(x)
    except Exception:
        return lo
    return max(lo, min(hi, x))


def _tier(score: float, tiers: Dict[str, float]) -> str:
    if score >= float(tiers["CRITICAL"]):
        return "CRITICAL"
    if score >= float(tiers["HIGH"]):
        return "HIGH"
    if score >= float(tiers["MEDIUM"]):
        return "MEDIUM"
    return "LOW"


def _today() -> date:
    return date.today()


def _parse_date_iso(s: str) -> date:
    return date.fromisoformat(s)


def _norm_ratio(value: Optional[float], max_value: float) -> float:
    if value is None:
        return 0.0
    try:
        v = float(value)
    except Exception:
        return 0.0
    if max_value <= 0:
        return 0.0
    return _clamp((v / max_value) * 100.0)


# Alias area di copertura -> need_key del checkup. La matrice prodotti usa "Viaggi" mentre
# il need corrispondente nel checkup si chiama "vita_privata_viaggi".
COVERAGE_AREA_ALIASES = {
    "viaggi": "vita_privata_viaggi",
}


def canonical_key(text: Any) -> str:
    """Stessa normalizzazione di checkup_to_insurance_needs_balanced.py: lowercase,
    rimozione diacritici, sequenze non alfanumeriche -> underscore."""
    if not text:
        return ""
    s = str(text).strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("&", " e ")
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def coverage_area_key(raw_area: Any) -> str:
    key = canonical_key(raw_area)
    return COVERAGE_AREA_ALIASES.get(key, key)


# ============================================================
# Data Models
# ============================================================

@dataclass
class Guarantee:
    """Garanzia presente su una polizza. coverage_area e' la chiave canonica dell'area di
    copertura della matrice prodotti (colonna F), che coincide con la need_key del checkup
    (es. "casa", "infortuni", "vita_privata_animali_domestici").
    code e' null per i prodotti Vita mappati a livello prodotto nella matrice."""
    coverage_area: str
    code: Optional[str] = None
    description: Optional[str] = None


@dataclass
class Policy:
    policy_number: str
    product: str
    premium: float
    expiry_date: date
    churn_rate: Optional[float] = None
    guarantees: List[Guarantee] = field(default_factory=list)


@dataclass
class Client:
    client_id: str
    email: Optional[str]
    phone: Optional[str]
    last_contact_days: Optional[int]
    birthday_days: Optional[int]
    anniversary_days: Optional[int]
    unpaid_days: List[int]
    cross_sell_gaps: List[str]
    insurance_needs: Optional[List[Dict[str, Any]]] = None
    policies: List[Policy] = None

    # engagement / preference
    preferred_channel: Optional[str] = None  # PHONE/EMAIL/SMS/WHATSAPP
    whatsapp_enabled: Optional[bool] = None

    viva_points: Optional[float] = None
    viva_enrolled: Optional[bool] = None
    checkup_done: Optional[bool] = None
    viva_points_expiring: Optional[int] = None

    # advanced opportunity
    active_campaigns: Optional[List[Dict[str, Any]]] = None
    pending_quotes: Optional[List[Dict[str, Any]]] = None

    # claims/complaints
    claims: Optional[List[Dict[str, Any]]] = None
    complaints: Optional[List[Dict[str, Any]]] = None

    # value drivers
    customer_tenure_years: Optional[float] = None
    active_policies_count: Optional[int] = None
    agency_profitability: Optional[float] = None
    company_profitability_sp: Optional[float] = None
    auto_premium_normalized: Optional[float] = None
    auto_guarantees_weight_vct: Optional[float] = None
    non_auto_premium_total: Optional[float] = None


@dataclass
class Lead:
    lead_id: str
    product: str
    created_hours_ago: int
    last_contact_days: Optional[int]
    quote_premium: Optional[float]
    coverage_start_days: Optional[int]
    marketing_consent: bool

    preferred_channel: Optional[str] = None
    whatsapp_enabled: Optional[bool] = None
    phone: Optional[str] = None
    email: Optional[str] = None


def _dedupe_preserve(seq: List[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for x in seq:
        xs = str(x).upper()
        if not xs or xs in seen:
            continue
        seen.add(xs)
        out.append(xs)
    return out


def covered_areas_from_policies(policies: List[Policy]) -> Set[str]:
    """
    Insieme (uppercased) delle aree di copertura possedute dal cliente.

    Fonte primaria: policies[*].guarantees[*].coverage_area — la chiave canonica dell'area
    di copertura dalla matrice prodotti, che coincide con la need_key del checkup.
    Fallback legacy: il nome prodotto canonicalizzato (datasets storici dove
    policies[].product coincideva con la need_key, es. "casa").
    """
    covered: Set[str] = set()
    for p in policies or []:
        for g in getattr(p, "guarantees", None) or []:
            area = coverage_area_key(getattr(g, "coverage_area", None))
            if area:
                covered.add(area.upper())
        prod = canonical_key(getattr(p, "product", None))
        if prod:
            covered.add(prod.upper())
    return covered


def derive_cross_sell_gaps_from_insurance_needs(insurance_needs: Any, policies: List[Policy]) -> List[str]:
    """
    Derives cross-sell gaps directly from the insurance_needs structure.

    Rule implemented:
    - for each need_key in insurance_needs[*].needs
    - if at least one event has necessary == True
    - and the need is not already covered by an owned guarantee
      (policies[].guarantees[].coverage_area, matrice prodotti)
    => emit the need_key as a COVERAGE_GAPS entry (uppercased).

    Notes:
    - selected / activeWithVittoria are intentionally not used for suppression here
      because the authoritative ownership source is the policies' guarantees.
    - legacy fallback: the canonicalized product name also counts as covered, for
      datasets where policies[].product carried the need key directly.
    - if insurance_needs is missing or malformed, returns [].
    """
    if not insurance_needs or not isinstance(insurance_needs, list):
        return []

    owned = covered_areas_from_policies(policies)
    derived: List[str] = []

    for block in insurance_needs:
        if not isinstance(block, dict):
            continue
        needs = block.get('needs') or {}
        if not isinstance(needs, dict):
            continue

        for need_key, need_data in needs.items():
            if not isinstance(need_data, dict):
                continue
            events = need_data.get('events') or {}
            if not isinstance(events, dict):
                continue

            has_necessary = any(
                isinstance(ev, dict) and ev.get('necessary') is True
                for ev in events.values()
            )
            if not has_necessary:
                continue

            gap = canonical_key(need_key).upper()
            if gap and gap not in owned:
                derived.append(gap)

    return _dedupe_preserve(derived)


def client_from_dict(d: Dict[str, Any]) -> Client:
    policies = []
    for p in d.get("policies", []) or []:
        guarantees = []
        for g in p.get("guarantees", []) or []:
            if not isinstance(g, dict):
                continue
            guarantees.append(
                Guarantee(
                    coverage_area=str(g.get("coverage_area", "") or ""),
                    code=g.get("code"),
                    description=g.get("description"),
                )
            )
        policies.append(
            Policy(
                policy_number=str(p.get("policy_number")),
                product=str(p.get("product", "N/A")),
                premium=float(p.get("premium", 0) or 0),
                expiry_date=_parse_date_iso(p.get("expiry_date")),
                churn_rate=(float(p["churn_rate"]) if p.get("churn_rate") is not None else None),
                guarantees=guarantees,
            )
        )

    insurance_needs = d.get("insurance_needs")
    legacy_cross_sell_gaps = list(d.get("cross_sell_gaps", []) or [])
    derived_cross_sell_gaps = derive_cross_sell_gaps_from_insurance_needs(insurance_needs, policies)

    # New model wins if present; otherwise preserve backward compatibility with legacy field.
    cross_sell_gaps = derived_cross_sell_gaps if derived_cross_sell_gaps else _dedupe_preserve(legacy_cross_sell_gaps)

    return Client(
        client_id=str(d.get("client_id")),
        email=d.get("email"),
        phone=d.get("phone"),
        last_contact_days=d.get("last_contact_days"),
        birthday_days=d.get("birthday_days"),
        anniversary_days=d.get("anniversary_days"),
        unpaid_days=list(d.get("unpaid_days", []) or []),
        cross_sell_gaps=cross_sell_gaps,
        insurance_needs=insurance_needs,
        policies=policies,
        preferred_channel=(d.get("preferred_channel") or None),
        whatsapp_enabled=d.get("whatsapp_enabled"),
        viva_points=d.get("viva_points"),
        viva_enrolled=d.get("viva_enrolled"),
        checkup_done=d.get("checkup_done"),
        viva_points_expiring=d.get("viva_points_expiring"),
        active_campaigns=d.get("active_campaigns"),
        pending_quotes=d.get("pending_quotes"),
        claims=d.get("claims"),
        complaints=d.get("complaints"),
        customer_tenure_years=d.get("customer_tenure_years"),
        active_policies_count=d.get("active_policies_count"),
        agency_profitability=d.get("agency_profitability"),
        company_profitability_sp=d.get("company_profitability_sp"),
        auto_premium_normalized=d.get("auto_premium_normalized"),
        auto_guarantees_weight_vct=d.get("auto_guarantees_weight_vct"),
        non_auto_premium_total=d.get("non_auto_premium_total"),
    )


def lead_from_dict(d: Dict[str, Any]) -> Lead:
    return Lead(
        lead_id=str(d.get("lead_id")),
        product=str(d.get("product", "N/A")),
        created_hours_ago=int(d.get("created_hours_ago", 999999) or 999999),
        last_contact_days=d.get("last_contact_days"),
        quote_premium=(float(d["quote_premium"]) if d.get("quote_premium") is not None else None),
        coverage_start_days=d.get("coverage_start_days"),
        marketing_consent=bool(d.get("marketing_consent", False)),
        preferred_channel=d.get("preferred_channel"),
        whatsapp_enabled=d.get("whatsapp_enabled"),
        phone=d.get("phone"),
        email=d.get("email"),
    )


# ============================================================
# Availability + channel selection (decisions PC1-B, PC2-B, PC3-C, A-SMS1, A-WA2, L2)
# ============================================================

CHANNELS = ("WHATSAPP", "SMS", "PHONE", "EMAIL")


def _channel_available_client(c: Client, channel: str) -> bool:
    channel = channel.upper()
    if channel == "PHONE":
        return bool(c.phone)
    if channel == "EMAIL":
        return bool(c.email)
    if channel == "SMS":
        return bool(c.phone)  # A-SMS1
    if channel == "WHATSAPP":
        return bool(c.phone) and bool(c.whatsapp_enabled)  # A-WA2
    return False


def _channel_available_lead(l: Lead, channel: str) -> bool:
    channel = channel.upper()
    if channel == "PHONE":
        return bool(l.phone) or True  # lead default assumes reachable by phone (L2 baseline)
    if channel == "EMAIL":
        return bool(l.email)
    if channel == "SMS":
        return bool(l.phone)
    if channel == "WHATSAPP":
        return bool(l.phone) and bool(l.whatsapp_enabled)
    return False


def _fallback_order(strategic_category: str) -> List[str]:
    # PC3-C: configurable per strategic_category. We provide sensible defaults here.
    # You can later move these to a non-numeric settings file.
    sc = strategic_category.upper()
    if sc in ("RETENTION", "CONVERSION"):
        return ["PHONE", "WHATSAPP", "SMS", "EMAIL"]
    if sc in ("GROWTH", "NURTURING"):
        return ["EMAIL", "WHATSAPP", "SMS", "PHONE"]
    # SERVICE
    return ["WHATSAPP", "SMS", "PHONE", "EMAIL"]


def choose_channel_for_client(c: Client, strategic_category: str, intended: str) -> Optional[str]:
    # PC1-B: preferred_channel dominates
    pref = (c.preferred_channel or "").upper().strip()
    if pref:
        if _channel_available_client(c, pref):
            return pref
        for ch in _fallback_order(strategic_category):
            if _channel_available_client(c, ch):
                return ch
        return None

    # no preference: use intended then fallback
    intended = (intended or "").upper()
    if intended and _channel_available_client(c, intended):
        return intended
    for ch in _fallback_order(strategic_category):
        if _channel_available_client(c, ch):
            return ch
    return None


def choose_channel_for_lead(l: Lead, strategic_category: str) -> Optional[str]:
    # L2: PHONE default; exception if preferred_channel present and different
    pref = (l.preferred_channel or "").upper().strip()
    if pref and pref != "PHONE":
        if _channel_available_lead(l, pref):
            return pref
        for ch in _fallback_order(strategic_category):
            if _channel_available_lead(l, ch):
                return ch
        return "PHONE"
    return "PHONE"


# ============================================================
# Client Trigger Detection (includes new features)
# ============================================================

def detect_client_triggers(c: Client, cfg: Dict[str, Any]) -> Dict[str, Any]:
    thr = cfg["thresholds"]
    t: Dict[str, Any] = {}

    # Payment
    if c.unpaid_days:
        t["PAYMENT_OVERDUE"] = {"max_days_overdue": int(max(c.unpaid_days))}

    # Renewal (45d visibility)
    renewal = []
    for p in c.policies:
        days = (p.expiry_date - _today()).days
        if 0 <= days <= 45:
            renewal.append({"policy": p, "days_remaining": int(days)})
    if renewal:
        min_days = min(r["days_remaining"] for r in renewal)
        if min_days <= 7:
            t["RENEWAL_7D"] = {"policies": renewal}
        elif min_days <= 14:
            t["RENEWAL_14D"] = {"policies": renewal}
        elif min_days <= 30:
            t["RENEWAL_30D"] = {"policies": renewal}
        else:
            t["RENEWAL_45D"] = {"policies": renewal}
        if len(renewal) >= 2:
            t["MULTI_RENEWAL"] = {"policies": renewal}

    # Churn
    high_thr = float(thr["HIGH_CHURN_THRESHOLD"])
    single_thr = float(thr["SINGLE_POLICY_CHURN_THRESHOLD"])
    high = [p for p in c.policies if p.churn_rate is not None and float(p.churn_rate) >= high_thr]
    if high:
        t["HIGH_CHURN_RISK"] = {"policies": high}
    if len(c.policies) == 1:
        p = c.policies[0]
        if p.churn_rate is not None and float(p.churn_rate) >= single_thr:
            t["SINGLE_POLICY_RISK"] = {"policy": p}

    # Relationship (birthday/anniversary)
    if c.birthday_days is not None and 0 <= int(c.birthday_days) <= 7:
        t["BIRTHDAY"] = {"days_remaining": int(c.birthday_days)}
    if c.anniversary_days is not None and 0 <= int(c.anniversary_days) <= 30:
        t["CUSTOMER_ANNIVERSARY"] = {"days_remaining": int(c.anniversary_days)}

    # Contact overdue (only if contact history exists)
    if c.last_contact_days is not None and int(c.last_contact_days) >= int(thr["NO_CONTACT_DAYS_THRESHOLD"]):
        t["CONTACT_OVERDUE"] = {"days_since_contact": int(c.last_contact_days)}

    # Engagement
    if c.viva_enrolled is False:
        t["VIVA_NOT_ENROLLED"] = {"policy_count": len(c.policies)}
    if c.viva_points is not None and float(c.viva_points) > 1000:
        t["VIVA_POINTS_HIGH"] = {"balance": float(c.viva_points)}
    if c.viva_points_expiring is not None and int(c.viva_points_expiring) > 0:
        t["VIVA_POINTS_EXPIRING"] = {"expiring_points": int(c.viva_points_expiring)}
    if c.checkup_done is False:
        t["CHECKUP_NOT_DONE"] = {"policy_count": len(c.policies)}

    # Cross-sell gaps (derived from insurance_needs when present, otherwise legacy field;
    # suppressed when the need is already covered by an owned guarantee coverage_area
    # — legacy fallback: canonical product name)
    if c.cross_sell_gaps:
        owned = covered_areas_from_policies(c.policies)
        gaps_raw = [str(x).upper() for x in (c.cross_sell_gaps or [])]
        gaps = [g for g in gaps_raw if g and g not in owned]
        # de-duplicate while preserving order
        seen = set()
        gaps = [g for g in gaps if not (g in seen or seen.add(g))]
        if gaps:
            t["COVERAGE_GAPS"] = {"gaps": gaps}

    # Advanced opportunity: campaigns
    if c.active_campaigns:
        if isinstance(c.active_campaigns, list) and len(c.active_campaigns) > 0:
            t["ACTIVE_CAMPAIGN"] = {"campaigns": c.active_campaigns}

    # Pending quotes (client)
    if c.pending_quotes:
        if isinstance(c.pending_quotes, list) and len(c.pending_quotes) > 0:
            # derive quick metrics
            cnt = len(c.pending_quotes)
            nearest = None
            oldest = None
            for q in c.pending_quotes:
                sd = q.get("saved_at") or q.get("created_at")
                if sd:
                    try:
                        dd = (_today() - _parse_date_iso(sd)).days
                        oldest = dd if oldest is None else max(oldest, dd)
                    except Exception:
                        pass
                cs = q.get("coverage_start_date")
                if cs:
                    try:
                        dd = (_parse_date_iso(cs) - _today()).days
                        if dd >= 0:
                            nearest = dd if nearest is None else min(nearest, dd)
                    except Exception:
                        pass
            t["PENDING_QUOTE"] = {"count_pending": cnt, "nearest_coverage_start_days": nearest, "oldest_saved_days": oldest}

    # Claims / Complaints open (status != CLOSED)
    def _open_cases(items: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        if not items:
            return []
        out = []
        for it in items:
            st = str(it.get("status", "")).upper()
            if st and st != "CLOSED":
                out.append(it)
        return out

    open_claims = _open_cases(c.claims)
    open_complaints = _open_cases(c.complaints)
    if open_claims:
        t["OPEN_CLAIM"] = {"count_open": len(open_claims)}
    if open_complaints:
        t["OPEN_COMPLAINT"] = {"count_open": len(open_complaints)}

    # Service baseline (S2) only if no other triggers exist
    if not t:
        t["SERVICE_BASELINE"] = {"reason": "Ordinary service (no strong signals)"}

    return t


# ============================================================
# Client Scoring (baseline + qualitative boosts)
# ============================================================

def client_urgency_score(triggers: Dict[str, Any], cfg: Dict[str, Any]) -> float:
    thr = cfg["thresholds"]
    # Open cases boost (qualitative)
    open_case_boost = float(thr.get("OPEN_CASE_URGENCY_BOOST", 0))
    open_cases = ("OPEN_CLAIM" in triggers) or ("OPEN_COMPLAINT" in triggers)

    # payment precedence
    if "PAYMENT_OVERDUE" in triggers:
        d = int(triggers["PAYMENT_OVERDUE"]["max_days_overdue"])
        base = 100.0 if d >= 45 else 85.0 if d >= 30 else 70.0 if d >= 15 else 55.0
        return _clamp(base + (open_case_boost if open_cases else 0.0))

    # renewal precedence
    if "RENEWAL_7D" in triggers:
        base = 90.0
    elif "RENEWAL_14D" in triggers:
        base = 70.0
    elif "RENEWAL_30D" in triggers:
        base = 55.0
    elif "RENEWAL_45D" in triggers:
        base = 40.0
    else:
        base = 15.0

    return _clamp(base + (open_case_boost if open_cases else 0.0))


def client_opportunity_score(c: Client, triggers: Dict[str, Any], cfg: Dict[str, Any]) -> float:
    avg = cfg["avg_premiums"]
    thr = cfg["thresholds"]

    denom = sum(float(v) for v in avg.values())
    gap_score = 0.0
    if denom > 0 and c.cross_sell_gaps:
        num = sum(float(avg.get(str(g).upper(), 0.0)) for g in set(str(x).upper() for x in c.cross_sell_gaps))
        gap_score = _clamp((num / denom) * 100.0)

    # qualitative boosts
    if "ACTIVE_CAMPAIGN" in triggers:
        gap_score = _clamp(gap_score + float(thr.get("ACTIVE_CAMPAIGN_OPPORTUNITY_BOOST", 0)))
    if "VIVA_POINTS_EXPIRING" in triggers:
        gap_score = _clamp(gap_score + float(thr.get("VIVA_EXPIRING_OPPORTUNITY_BOOST", 0)))
    if "PENDING_QUOTE" in triggers:
        gap_score = _clamp(gap_score + float(thr.get("PENDING_QUOTE_OPPORTUNITY_BOOST", 0)))

    return gap_score


def client_recency_score(c: Client) -> float:
    d = c.last_contact_days
    if d is None:
        return 80.0
    d = int(d)
    if d < 30:
        return 30.0
    if d < 60:
        return 50.0
    if d < 90:
        return 70.0
    return 90.0


def client_relationship_modifier(c: Client) -> float:
    mod = 0.0
    if c.birthday_days is not None:
        bd = int(c.birthday_days)
        if bd == 0:
            mod += 10.0
        elif 1 <= bd <= 7:
            mod += 5.0
    if c.anniversary_days is not None:
        ad = int(c.anniversary_days)
        if ad == 0:
            mod += 10.0
        elif 1 <= ad <= 7:
            mod += 5.0
    return mod

    count = len([k for k in triggers.keys() if k not in excluded])
    return min(count * 5.0, 25.0)


def _premium_base_score(premium_total: float) -> float:
    if premium_total >= 3000:
        return 80.0
    if premium_total >= 2000:
        return 65.0
    if premium_total >= 1000:
        return 50.0
    if premium_total >= 500:
        return 35.0
    return 20.0


def _weighted_churn_avg(policies: List[Policy]) -> float:
    total = sum(p.premium for p in policies)
    if total <= 0:
        return 0.0
    num = sum((float(p.churn_rate or 0.0) * p.premium) for p in policies)
    return num / total


def client_value_score(c: Client, triggers: Dict[str, Any], cfg: Dict[str, Any], debug: bool = False) -> Tuple[float, Optional[Dict[str, Any]]]:
    thr = cfg["thresholds"]

    # Premium total adjusted (V3-A): auto normalized substitutes raw auto
    total_premium = sum(p.premium for p in c.policies)
    auto_raw = sum(p.premium for p in c.policies if str(p.product).upper() == "AUTO")
    auto_norm = c.auto_premium_normalized
    if auto_norm is not None:
        premium_total_adj = max(0.0, float(total_premium) - float(auto_raw) + float(auto_norm))
    else:
        premium_total_adj = float(total_premium)

    base_tier = _premium_base_score(premium_total_adj)

    # churn multiplier applied ONLY to premium-based component (C1)
    churn_avg = _weighted_churn_avg(c.policies)
    mult = 1.4 if churn_avg >= 0.5 else 1.2 if churn_avg >= 0.3 else 1.0
    premium_based = min(base_tier * mult, 100.0)

    # preserve SINGLE_POLICY_RISK floor
    if "SINGLE_POLICY_RISK" in triggers:
        premium_based = max(premium_based, 50.0)

    # Additional drivers (V1=TUTTI), missing ignored (M1)
    # Normalize each driver to 0..100 and blend with a simple average.
    add_parts = {}
    add_scores = []

    # tenure
    if c.customer_tenure_years is not None:
        s = _norm_ratio(c.customer_tenure_years, float(thr.get("VALUE_TENURE_MAX_YEARS", 25)))
        add_parts["tenure"] = s
        add_scores.append(s)

    # active policies count
    if c.active_policies_count is not None:
        s = _norm_ratio(c.active_policies_count, float(thr.get("VALUE_POLICYCOUNT_MAX", 8)))
        add_parts["policy_count"] = s
        add_scores.append(s)

    # agency profitability
    if c.agency_profitability is not None:
        s = _norm_ratio(c.agency_profitability, float(thr.get("VALUE_AGENCY_PROFIT_MAX", 2000)))
        add_parts["agency_profitability"] = s
        add_scores.append(s)

    # company S/P (lower is better; convert to value score)
    if c.company_profitability_sp is not None:
        max_sp = float(thr.get("VALUE_COMPANY_SP_MAX", 1.0))
        try:
            sp = float(c.company_profitability_sp)
        except Exception:
            sp = None
        if sp is not None and max_sp > 0:
            # 0 is best; max_sp is worst; clamp and invert
            sp_clamped = max(0.0, min(max_sp, sp))
            s = _clamp((1.0 - (sp_clamped / max_sp)) * 100.0)
            add_parts["company_sp"] = s
            add_scores.append(s)

    # auto normalized premium (already used in premium_total_adj, but revision also wants it as driver)
    # Under V3-A, we still allow it as an additional driver signal (not double-counting raw auto).
    if c.auto_premium_normalized is not None:
        s = _norm_ratio(c.auto_premium_normalized, float(thr.get("VALUE_AUTO_NORM_MAX", 2000)))
        # adjust by VCT weight if provided
        if c.auto_guarantees_weight_vct is not None:
            try:
                wv = float(c.auto_guarantees_weight_vct)
                s = _clamp(s * _clamp(wv, 0.0, 2.0) / 1.0)
            except Exception:
                pass
        add_parts["auto_norm"] = s
        add_scores.append(s)

    # non-auto premium total
    if c.non_auto_premium_total is not None:
        s = _norm_ratio(c.non_auto_premium_total, float(thr.get("VALUE_NONAUTO_PREM_MAX", 5000)))
        add_parts["non_auto_premium"] = s
        add_scores.append(s)

    additional = (sum(add_scores) / len(add_scores)) if add_scores else 0.0

    # Combine: keep premium_based as the core; add up to +20 points from additional drivers (scaled)
    # (qualitative—no hard numbers from revision; this is a pragmatic bounded addition)
    combined = _clamp(premium_based + (additional * 0.20))

    breakdown = None
    if debug:
        breakdown = {
            "premium_based": {
                "premium_total": total_premium,
                "auto_raw": auto_raw,
                "auto_norm": auto_norm,
                "premium_total_adjusted": premium_total_adj,
                "base_tier_score": base_tier,
                "churn_weighted_avg": churn_avg,
                "churn_multiplier": mult,
                "premium_based_value_score": premium_based,
            },
            "drivers_additional": add_parts,
            "additional_avg": additional,
            "value_score_final": combined,
        }

    return combined, breakdown


def churn_override(triggers: Dict[str, Any], cfg: Dict[str, Any]) -> bool:
    thr = cfg["thresholds"]
    if "HIGH_CHURN_RISK" not in triggers:
        return False
    # must have renewal within CHURN_OVERRIDE_RENEWAL_DAYS on same policy
    renew_days = int(thr["CHURN_OVERRIDE_RENEWAL_DAYS"])
    renewal_pols = []
    for k in ("RENEWAL_7D", "RENEWAL_14D", "RENEWAL_30D", "RENEWAL_45D", "MULTI_RENEWAL"):
        if k in triggers:
            renewal_pols.extend(triggers[k]["policies"])
    if not renewal_pols:
        return False
    renewal_map = {r["policy"].policy_number: int(r["days_remaining"]) for r in renewal_pols}
    for p in triggers["HIGH_CHURN_RISK"]["policies"]:
        pn = p.policy_number
        if pn in renewal_map and renewal_map[pn] <= renew_days:
            return True
    return False


def client_total_score(c: Client, triggers: Dict[str, Any], cfg: Dict[str, Any], debug: bool = False) -> Tuple[float, str, Optional[Dict[str, Any]]]:
    w = cfg["client_weights"]
    tiers = cfg["tiers"]

    urgency = client_urgency_score(triggers, cfg)
    value, breakdown = client_value_score(c, triggers, cfg, debug=debug)
    opportunity = client_opportunity_score(c, triggers, cfg)
    recency = client_recency_score(c)

    base = (
        urgency * float(w["urgency"]) +
        value * float(w["value"]) +
        opportunity * float(w["opportunity"]) +
        recency * float(w["recency"])
    )
    # Multi-trigger bonus removed: total score depends only on weighted components and relationship modifier
    score = _clamp(base + client_relationship_modifier(c))

    # churn override lifts score to CRITICAL threshold
    if churn_override(triggers, cfg):
        score = max(score, float(tiers["CRITICAL"]))

    return score, _tier(score, tiers), breakdown


# ============================================================
# Strategic category assignment (Retention > Growth; Service baseline) + suppression rules
# ============================================================

def assign_strategic_category_client(triggers: Dict[str, Any]) -> str:
    # Retention conditions
    retention = any(k in triggers for k in (
        "PAYMENT_OVERDUE",
        "RENEWAL_7D", "RENEWAL_14D", "RENEWAL_30D", "RENEWAL_45D", "MULTI_RENEWAL",
        "HIGH_CHURN_RISK", "SINGLE_POLICY_RISK",
        "OPEN_CLAIM", "OPEN_COMPLAINT",
    ))
    # Growth conditions
    growth = any(k in triggers for k in (
        "COVERAGE_GAPS",
        "VIVA_NOT_ENROLLED", "VIVA_POINTS_HIGH", "VIVA_POINTS_EXPIRING",
        "CHECKUP_NOT_DONE",
        "ACTIVE_CAMPAIGN",
        "PENDING_QUOTE",
    ))
    if retention:
        return "RETENTION"
    if growth:
        return "GROWTH"
    return "SERVICE"


def assign_strategic_category_lead(triggers: Dict[str, Any]) -> str:
    # CONVERSION maps to LEAD_CONVERSION, FIRST_CONTACT, QUOTE_FOLLOW_UP; NURTURING to RE_ENGAGEMENT
    conv = any(k in triggers for k in ("COVERAGE_START_SOON", "QUOTE_READY", "HIGH_VALUE_QUOTE", "NEW_LEAD"))
    nurt = "STALE_LEAD" in triggers
    if conv:
        return "CONVERSION"
    if nurt:
        return "NURTURING"
    return "CONVERSION"


# ============================================================
# Action generation and overrides (case-management forced primary, churn override forced primary)
# ============================================================

ACTION_ORDER_CLIENT = [
    "PAYMENT",
    "RENEWAL",
    "CHURN_PREVENTION",
    "CROSS_SELL",
    "VIVA",
    "CHECKUP",
    "RELATIONSHIP",
]


def _cosa_payment(triggers: Dict[str, Any]) -> str:
    d = int(triggers["PAYMENT_OVERDUE"]["max_days_overdue"])
    if d >= 45:
        return f"Gestire insoluto polizza - scaduto da {d} giorni. Rischio cancellazione."
    return f"Gestire insoluto polizza - scaduto da {d} giorni."


def _cosa_renewal(triggers: Dict[str, Any]) -> str:
    # pick min days, tie-break highest premium
    items = []
    for k in ("RENEWAL_7D", "RENEWAL_14D", "RENEWAL_30D", "RENEWAL_45D", "MULTI_RENEWAL"):
        if k in triggers:
            for r in triggers[k]["policies"]:
                items.append((r["policy"], int(r["days_remaining"])))
    if not items:
        return "Gestire rinnovo - polizza in scadenza"
    pol, d = sorted(items, key=lambda x: (x[1], -x[0].premium))[0]
    if d == 0:
        return f"Rinnovo urgente {pol.product} - scade oggi (€{pol.premium}/anno)"
    if d <= 7:
        return f"Rinnovo urgente {pol.product} - scadenza tra {d} giorni (€{pol.premium}/anno)"
    if d <= 14:
        return f"Rinnovo {pol.product} in scadenza tra {d} giorni (€{pol.premium}/anno)"
    if d <= 30:
        return f"Rinnovo {pol.product} in scadenza tra {d} giorni (€{pol.premium}/anno) - verificare intenzioni"
    return f"Primo contatto per rinnovo {pol.product} in scadenza tra {d} giorni (€{pol.premium}/anno)"


def _cosa_churn(triggers: Dict[str, Any]) -> str:
    if "HIGH_CHURN_RISK" in triggers:
        pol = sorted(triggers["HIGH_CHURN_RISK"]["policies"], key=lambda p: -(float(p.churn_rate or 0.0)))[0]
        return f"Rischio abbandono - polizza {pol.product} rischio {int(float(pol.churn_rate or 0.0) * 100)}%"
    if "SINGLE_POLICY_RISK" in triggers:
        p = triggers["SINGLE_POLICY_RISK"]["policy"]
        return f"Attenzione - unica polizza {p.product} con rischio abbandono {int(float(p.churn_rate or 0.0) * 100)}%"
    return "Rischio abbandono cliente"


# Etichette commerciali per i gap: need_key del checkup (nuovo modello) + chiavi legacy.
GAP_PRODUCT_LABELS = {
    # need keys (checkup / matrice prodotti)
    "CASA": "polizza Casa",
    "INFORTUNI": "polizza Infortuni",
    "MALATTIA": "polizza Malattia",
    "VITA_PROTEZIONE": "polizza Vita Protezione",
    "PREVIDENZA_COMPLEMENTARE": "soluzione di Previdenza Complementare",
    "RESPONSABILITA_PROFESSIONALE": "polizza Responsabilità Professionale",
    "VITA_PRIVATA_RESPONSABILITA_CIVILE": "polizza Responsabilità Civile Vita Privata",
    "VITA_PRIVATA_ANIMALI_DOMESTICI": "polizza Animali Domestici",
    "VITA_PRIVATA_TUTELA_LEGALE": "polizza Tutela Legale",
    "VITA_PRIVATA_MICROMOBILITA": "polizza Micromobilità",
    "VITA_PRIVATA_VIAGGI": "polizza Viaggi",
    # chiavi legacy
    "HOME": "polizza Casa",
    "AUTO": "polizza Auto",
    "VITA": "polizza Vita",
    "PET": "polizza Animali",
}


def _cosa_cross_sell(c: Client, gaps: Optional[List[str]] = None) -> str:
    gaps = [str(x).upper() for x in (gaps if gaps is not None else c.cross_sell_gaps)]
    if not gaps:
        return "Proposta commerciale - opportunità di copertura"
    # choose biggest avg premium later; for now pick first
    g = gaps[0]
    if g == "UPSELL":
        return "Upgrade polizza Auto - opportunità di upsell rilevata"
    label = GAP_PRODUCT_LABELS.get(g)
    if label:
        return f"Proporre {label} - gap di copertura rilevato"
    return f"Proporre copertura {g}"


def _growth_rationale_blocks(c: Client, triggers: Dict[str, Any]) -> List[str]:
    blocks = []
    if "ACTIVE_CAMPAIGN" in triggers:
        # pick first campaign name
        camps = triggers["ACTIVE_CAMPAIGN"].get("campaigns") or []
        if camps:
            name = camps[0].get("name") or camps[0].get("campaign_id") or "campagna"
            blocks.append(f"Leva commerciale: {name}")
    if "VIVA_POINTS_EXPIRING" in triggers:
        pts = triggers["VIVA_POINTS_EXPIRING"].get("expiring_points")
        blocks.append(f"Punti Viva in scadenza: {pts} punti")
    if "PENDING_QUOTE" in triggers:
        pq = triggers["PENDING_QUOTE"]
        near = pq.get("nearest_coverage_start_days")
        old = pq.get("oldest_saved_days")
        parts = []
        if near is not None:
            parts.append(f"decorrenza tra {near} giorni")
        if old is not None:
            parts.append(f"salvato {old} giorni fa")
        blocks.append("Preventivo/bozza in sospeso" + (" — " + ", ".join(parts) if parts else ""))
    return blocks


def _cosa_viva(c: Client, triggers: Dict[str, Any]) -> str:
    if "VIVA_POINTS_EXPIRING" in triggers:
        pts = triggers["VIVA_POINTS_EXPIRING"].get("expiring_points")
        return f"Punti Viva in scadenza: {pts} punti - contattare il cliente"
    if "VIVA_POINTS_HIGH" in triggers:
        bal = triggers["VIVA_POINTS_HIGH"].get("balance")
        return f"Informare su {int(bal)} punti VIVA non utilizzati"
    return "Proporre iscrizione programma VIVA"


def _cosa_checkup() -> str:
    return "Proporre analisi dei bisogni assicurativi"


def _cosa_relationship(c: Client, triggers: Dict[str, Any]) -> str:
    # Service baseline ordinary
    if "SERVICE_BASELINE" in triggers:
        return "Azione ordinaria: nessuna situazione che richiede attenzione specifica. Valutare contatto di cortesia/manutenzione."

    # Relationship rationale when claims/complaints are present
    has_claim = "OPEN_CLAIM" in triggers
    has_compl = "OPEN_COMPLAINT" in triggers
    if has_claim and has_compl:
        return "Sinistro e reclamo aperti in gestione — verificare stato e contattare il cliente."
    if has_claim:
        return "Sinistro aperto in gestione — verificare stato e contattare il cliente."
    if has_compl:
        return "Reclamo aperto in gestione — verificare stato e contattare il cliente."

    if "CONTACT_OVERDUE" in triggers:
        d = triggers["CONTACT_OVERDUE"]["days_since_contact"]
        return f"Riprendere contatto - nessuna interazione da {d} giorni"
    if "BIRTHDAY" in triggers:
        d = triggers["BIRTHDAY"]["days_remaining"]
        return "Inviare auguri di compleanno" if d == 0 else f"Compleanno tra {d} giorni - buona occasione per un contatto"
    if "CUSTOMER_ANNIVERSARY" in triggers:
        return "Celebrare anniversario cliente"
    return "Mantenere relazione cliente"


def _intended_channel_by_action_category(cat: str, triggers: Dict[str, Any], strategic_category: str) -> str:
    # Baseline-like intended channels, but preference dominates anyway.
    if cat == "PAYMENT":
        return "PHONE"
    if cat == "RENEWAL":
        return "PHONE"
    if cat in ("CHURN_PREVENTION", "CROSS_SELL", "CHECKUP"):
        return "PHONE"
    if cat == "VIVA":
        # if not enrolled, email else phone; simplistic
        return "EMAIL" if "VIVA_NOT_ENROLLED" in triggers else "PHONE"
    if cat == "RELATIONSHIP":
        # service: sms/wa preferred by strategic category; otherwise email
        return "SMS" if strategic_category == "SERVICE" else "EMAIL"
    return "PHONE"


def _primary_override_churn(triggers: Dict[str, Any], cfg: Dict[str, Any]) -> bool:
    return churn_override(triggers, cfg)


def _select_primary_action_category(active_categories: List[str], triggers: Dict[str, Any], cfg: Dict[str, Any]) -> str:
    # Claim/complaint are no longer hard overrides: they remain normal weighted triggers and
    # can still activate RELATIONSHIP, but primary selection follows the standard precedence.
    # Baseline churn override still forces CHURN_PREVENTION primary.
    if _primary_override_churn(triggers, cfg):
        return "CHURN_PREVENTION"
    for cat in ACTION_ORDER_CLIENT:
        if cat in active_categories:
            return cat
    return active_categories[0] if active_categories else "RELATIONSHIP"


# ============================================================
# Presentation mode (UI policy): task-level, default INLINE, LOW => INLINE
# ============================================================

def presentation_mode(priority_tier: str) -> str:
    # UI3-C + non invasiveness; without policy table, always INLINE.
    if priority_tier == "LOW":
        return "INLINE"
    return "INLINE"


# ============================================================
# Public functions
# ============================================================

def generate_client_nba(client_dict: Dict[str, Any], debug: bool = False) -> Optional[Dict[str, Any]]:
    cfg = get_config()
    c = client_from_dict(client_dict)

    # contactability: if no phone and no email, skip
    if not (c.phone or c.email):
        return None

    triggers = detect_client_triggers(c, cfg)

    # Apply trigger enable/disable from user catalog overrides
    from nba_catalog import filter_enabled_triggers
    triggers = filter_enabled_triggers(triggers, scope="client")
    if not triggers:
        return None

    # score
    score, tier, value_breakdown = client_total_score(c, triggers, cfg, debug=debug)

    # strategic category
    strategic = assign_strategic_category_client(triggers)

    # active action categories
    active_categories: List[str] = []
    if "PAYMENT_OVERDUE" in triggers:
        active_categories.append("PAYMENT")
    if any(k in triggers for k in ("RENEWAL_7D", "RENEWAL_14D", "RENEWAL_30D", "RENEWAL_45D", "MULTI_RENEWAL")):
        active_categories.append("RENEWAL")
    if any(k in triggers for k in ("HIGH_CHURN_RISK", "SINGLE_POLICY_RISK")):
        active_categories.append("CHURN_PREVENTION")
    if "COVERAGE_GAPS" in triggers:
        active_categories.append("CROSS_SELL")
    if any(k in triggers for k in ("VIVA_NOT_ENROLLED", "VIVA_POINTS_HIGH", "VIVA_POINTS_EXPIRING")):
        active_categories.append("VIVA")
    if "CHECKUP_NOT_DONE" in triggers:
        active_categories.append("CHECKUP")
    if any(k in triggers for k in ("CONTACT_OVERDUE", "BIRTHDAY", "CUSTOMER_ANNIVERSARY", "SERVICE_BASELINE", "OPEN_CLAIM", "OPEN_COMPLAINT")):
        active_categories.append("RELATIONSHIP")

    # High churn suppression of growth actions: remove CROSS_SELL/VIVA/CHECKUP when HIGH_CHURN_RISK present
    if "HIGH_CHURN_RISK" in triggers:
        active_categories = [x for x in active_categories if x not in ("CROSS_SELL", "VIVA", "CHECKUP")]

    primary_cat = _select_primary_action_category(active_categories, triggers, cfg)

    actions = []
    for cat in ACTION_ORDER_CLIENT:
        if cat not in active_categories:
            continue

        if cat == "PAYMENT":
            cosa = _cosa_payment(triggers)
        elif cat == "RENEWAL":
            cosa = _cosa_renewal(triggers)
        elif cat == "CHURN_PREVENTION":
            cosa = _cosa_churn(triggers)
        elif cat == "CROSS_SELL":
            base = _cosa_cross_sell(c)
            blocks = _growth_rationale_blocks(c, triggers)
            cosa = base + (" — " + " — ".join(blocks) if blocks else "")
        elif cat == "VIVA":
            base = _cosa_viva(c, triggers)
            blocks = _growth_rationale_blocks(c, triggers)
            cosa = base + (" — " + " — ".join(blocks) if blocks else "")
        elif cat == "CHECKUP":
            base = _cosa_checkup()
            blocks = _growth_rationale_blocks(c, triggers)
            cosa = base + (" — " + " — ".join(blocks) if blocks else "")
        else:
            cosa = _cosa_relationship(c, triggers)

        is_primary = (cat == primary_cat)
        priority_within = "PRIMARY" if is_primary else "SECONDARY"

        intended = _intended_channel_by_action_category(cat, triggers, strategic)
        channel = choose_channel_for_client(c, strategic, intended)
        if channel is None:
            return None

        suggest_appt = (cat in ("CHURN_PREVENTION", "CROSS_SELL", "CHECKUP"))

        actions.append({
            "action_category": cat,
            "recommended_action": cosa,
            "recommended_channel": channel,
            "suggest_appointment": bool(suggest_appt),
            "primary": bool(is_primary),
            "priority_within_task": priority_within,
        })

    # Ensure we always have at least one action; Service baseline should guarantee
    if not actions:
        triggers = {"SERVICE_BASELINE": {"reason": "Ordinary service (no strong signals)"}}
        strategic = "SERVICE"
        channel = choose_channel_for_client(c, strategic, "SMS") or "PHONE"
        actions = [{
            "action_category": "RELATIONSHIP",
            "recommended_action": _cosa_relationship(c, triggers),
            "recommended_channel": channel,
            "suggest_appointment": False,
            "primary": True,
            "priority_within_task": "PRIMARY",
        }]

    out = {
        "target_id": c.client_id,
        "target_type": "CLIENT",
        "priority_score": round(float(score), 2),
        "priority_tier": tier,
        "strategic_category": strategic,
        "presentation_mode": presentation_mode(tier),
        "triggers": sorted(list(triggers.keys())),
        "trigger_details": {k: triggers[k] for k in sorted(list(triggers.keys()))},
        "recommended_actions": actions,
    }

    if debug and value_breakdown is not None:
        out["value_breakdown"] = value_breakdown

    return out


def detect_lead_triggers(l: Lead, cfg: Dict[str, Any]) -> Dict[str, Any]:
    thr = cfg["thresholds"]
    t: Dict[str, Any] = {}

    # coverage start soon
    if l.coverage_start_days is not None and 0 <= int(l.coverage_start_days) <= int(thr["LEAD_COVERAGE_START_SOON_DAYS"]):
        t["COVERAGE_START_SOON"] = {"days_remaining": int(l.coverage_start_days)}

    # quotes
    if l.quote_premium is not None:
        t["QUOTE_READY"] = {"premium": float(l.quote_premium)}
        if float(l.quote_premium) >= float(thr["LEAD_HIGH_VALUE_PREMIUM_THRESHOLD"]):
            t["HIGH_VALUE_QUOTE"] = {"premium": float(l.quote_premium)}

    # new lead
    if l.created_hours_ago <= int(thr["LEAD_NEW_HOURS_THRESHOLD"]):
        t["NEW_LEAD"] = {"hours_since_creation": int(l.created_hours_ago)}

    # stale lead
    if ("NEW_LEAD" not in t) and (l.last_contact_days is None):
        if l.created_hours_ago >= int(thr["LEAD_STALE_DAYS_THRESHOLD"]) * 24:
            t["STALE_LEAD"] = {"days_since_creation": int(l.created_hours_ago // 24)}

    return t


def lead_scores(l: Lead, triggers: Dict[str, Any], cfg: Dict[str, Any]) -> Tuple[float, str]:
    w = cfg["lead_weights"]
    tiers = cfg["tiers"]

    # urgency
    if "COVERAGE_START_SOON" in triggers:
        d = int(triggers["COVERAGE_START_SOON"]["days_remaining"])
        urg = 85.0 if d <= 3 else 75.0 if d <= 7 else 60.0
    elif "NEW_LEAD" in triggers:
        h = int(triggers["NEW_LEAD"]["hours_since_creation"])
        urg = 90.0 if h <= 4 else 80.0 if h <= 12 else 70.0 if h <= 24 else 55.0
    elif "STALE_LEAD" in triggers:
        urg = 50.0
    else:
        urg = 30.0

    # value
    if "HIGH_VALUE_QUOTE" in triggers:
        val = 100.0
    elif "QUOTE_READY" in triggers:
        p = float(triggers["QUOTE_READY"]["premium"])
        val = 80.0 if p >= 400 else 60.0 if p >= 300 else 40.0
    else:
        val = 20.0

    # timing
    d = l.last_contact_days
    if d is None:
        tim = 90.0
    elif int(d) == 0:
        tim = 30.0
    elif int(d) == 1:
        tim = 50.0
    elif 2 <= int(d) <= 3:
        tim = 70.0
    else:
        tim = 85.0

    base = urg * float(w["urgency"]) + val * float(w["value"]) + tim * float(w["timing"]) 
    score = _clamp(base + min(len(triggers) * 6.0, 24.0))
    return score, _tier(score, tiers)


def lead_actions(l: Lead, triggers: Dict[str, Any], strategic: str, channel: str) -> List[Dict[str, Any]]:
    # map action categories (Conversion maps to lead_conversion, first_contact, quote_follow_up; nurturing to re_engagement)
    actions = []
    # Determine active operational categories
    if "COVERAGE_START_SOON" in triggers:
        actions.append(("LEAD_CONVERSION", f"Finalizzare {l.product} - copertura richiesta tra {triggers['COVERAGE_START_SOON']['days_remaining']} giorni"))
    if "HIGH_VALUE_QUOTE" in triggers:
        p = triggers["HIGH_VALUE_QUOTE"]["premium"]
        actions.append(("QUOTE_FOLLOW_UP", f"Presentare preventivo {l.product} €{p}/anno - alto valore"))
    elif "QUOTE_READY" in triggers:
        p = triggers["QUOTE_READY"]["premium"]
        actions.append(("QUOTE_FOLLOW_UP", f"Presentare preventivo {l.product} €{p}/anno"))
    if "NEW_LEAD" in triggers:
        h = triggers["NEW_LEAD"]["hours_since_creation"]
        if h < 4:
            txt = f"Primo contatto - richiesta {l.product} ricevuta {h} ore fa"
        elif h < 24:
            txt = f"Primo contatto - richiesta {l.product} ricevuta oggi"
        else:
            txt = f"Primo contatto - richiesta {l.product} ricevuta ieri"
        actions.append(("FIRST_CONTACT", txt))
    if "STALE_LEAD" in triggers:
        d = triggers["STALE_LEAD"]["days_since_creation"]
        actions.append(("RE_ENGAGEMENT", f"Contattare urgentemente - richiesta {l.product} ricevuta {d} giorni fa senza risposta"))

    # strategic mapping: CONVERSION includes lead_conversion, first_contact, quote_follow_up; NURTURING includes re_engagement
    if strategic == "NURTURING":
        # keep only re_engagement
        actions = [a for a in actions if a[0] == "RE_ENGAGEMENT"]
    else:
        # CONVERSION prevails: include conversion set, and optionally keep re_engagement as secondary
        pass

    # Primary: choose first in priority order
    order = ["LEAD_CONVERSION", "QUOTE_FOLLOW_UP", "FIRST_CONTACT", "RE_ENGAGEMENT"]
    primary_cat = None
    for oc in order:
        if any(a[0] == oc for a in actions):
            primary_cat = oc
            break
    if primary_cat is None and actions:
        primary_cat = actions[0][0]

    out = []
    for cat, txt in sorted(actions, key=lambda x: order.index(x[0]) if x[0] in order else 99):
        is_primary = (cat == primary_cat)
        out.append({
            "action_category": cat,
            "recommended_action": txt,
            "recommended_channel": channel,
            "suggest_appointment": False,
            "primary": is_primary,
            "priority_within_task": "PRIMARY" if is_primary else "SECONDARY",
        })
    return out


def generate_lead_nba(lead_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    cfg = get_config()
    l = lead_from_dict(lead_dict)

    if not l.marketing_consent:
        return None

    triggers = detect_lead_triggers(l, cfg)

    # Apply trigger enable/disable from user catalog overrides
    from nba_catalog import filter_enabled_triggers
    triggers = filter_enabled_triggers(triggers, scope="lead")
    if not triggers:
        return None
    if not triggers:
        return None

    score, tier = lead_scores(l, triggers, cfg)
    strategic = assign_strategic_category_lead(triggers)

    channel = choose_channel_for_lead(l, strategic)

    actions = lead_actions(l, triggers, strategic, channel)
    if not actions:
        return None

    return {
        "target_id": l.lead_id,
        "target_type": "LEAD",
        "priority_score": round(float(score), 2),
        "priority_tier": tier,
        "strategic_category": strategic,
        "presentation_mode": presentation_mode(tier),
        "triggers": sorted(list(triggers.keys())),
        "trigger_details": {k: triggers[k] for k in sorted(list(triggers.keys()))},
        "recommended_actions": actions,
    }