"""National Early Warning Score 2 (NEWS2) — deterioration scoring.

Weightings follow the Royal College of Physicians NEWS2 chart (RCP, 2017), the
standard used across the NHS. We score the five vital signs this EHR records:
respiratory rate, SpO2 (Scale 1), temperature, systolic BP and heart rate.

Consciousness (AVPU) defaults to Alert and supplemental oxygen defaults to room
air, because the vitals model does not capture them — both only ADD to the score
when abnormal, so the computed value is a conservative lower bound, never an
overstatement. This keeps the score defensible rather than invented.
"""


def _rr(v):
    if v is None:
        return None
    if v <= 8:
        return 3
    if v <= 11:
        return 1
    if v <= 20:
        return 0
    if v <= 24:
        return 2
    return 3


def _spo2(v):
    if v is None:
        return None
    if v >= 96:
        return 0
    if v >= 94:
        return 1
    if v >= 92:
        return 2
    return 3


def _temp(v):
    if v is None:
        return None
    if v <= 35.0:
        return 3
    if v <= 36.0:
        return 1
    if v <= 38.0:
        return 0
    if v <= 39.0:
        return 1
    return 2


def _sbp(v):
    if v is None:
        return None
    if v <= 90:
        return 3
    if v <= 100:
        return 2
    if v <= 110:
        return 1
    if v <= 219:
        return 0
    return 3


def _hr(v):
    if v is None:
        return None
    if v <= 40:
        return 3
    if v <= 50:
        return 1
    if v <= 90:
        return 0
    if v <= 110:
        return 1
    if v <= 130:
        return 2
    return 3


PARAMS = [
    ("respiratory_rate", _rr, "Respiration rate"),
    ("spo2", _spo2, "SpO₂"),
    ("temperature_c", _temp, "Temperature"),
    ("systolic_bp", _sbp, "Systolic BP"),
    ("heart_rate", _hr, "Heart rate"),
]

# Clinical response bands (RCP NEWS2). Any single parameter scoring 3 escalates
# to at least "medium" (urgent review) regardless of the aggregate.
BAND_META = {
    "high": {"label": "High", "response": "Emergency / continuous monitoring", "color": "red"},
    "medium": {"label": "Medium", "response": "Urgent clinician review", "color": "amber"},
    "low-medium": {"label": "Low-Medium", "response": "Review by registered nurse", "color": "yellow"},
    "low": {"label": "Low", "response": "Routine monitoring", "color": "green"},
    "unknown": {"label": "No score", "response": "Insufficient vitals", "color": "slate"},
}


def news2(vitals: dict) -> dict:
    """Compute a NEWS2 score from a dict of vital signs. Returns score, band and
    a per-parameter breakdown. `score` is None if no scorable vitals are present."""
    breakdown = {}
    total = 0
    any_three = False
    counted = 0
    for field, fn, label in PARAMS:
        s = fn(vitals.get(field))
        if s is None:
            continue
        counted += 1
        breakdown[field] = {"label": label, "value": vitals.get(field), "score": s}
        total += s
        if s == 3:
            any_three = True

    if counted == 0:
        return {"score": None, "band": "unknown", "any_param_3": False,
                "params_used": 0, "breakdown": {}, **BAND_META["unknown"]}

    if total >= 7:
        band = "high"
    elif total >= 5 or any_three:
        band = "medium"
    elif total >= 1:
        band = "low-medium"
    else:
        band = "low"

    return {"score": total, "band": band, "any_param_3": any_three,
            "params_used": counted, "breakdown": breakdown, **BAND_META[band]}
