"""Clinical decision-support safety checks.

Deliberately small, curated rule sets (not a full drug database) — enough to
catch the common, dangerous mistakes an EHR must never let slip silently:
allergy cross-reactivity, major drug-drug interactions, duplicate therapy, and
out-of-range vitals. Every rule is transparent and auditable.
"""
from typing import List, Dict, Optional

# Drug classes → member drugs (all lowercase, substring-matched).
ALLERGY_CLASSES = {
    "penicillin": ["penicillin", "amoxicillin", "ampicillin", "augmentin", "co-amoxiclav",
                   "cloxacillin", "flucloxacillin", "piperacillin", "amoxiclav"],
    "cephalosporin": ["cephalexin", "cefixime", "ceftriaxone", "cefuroxime", "cefpodoxime", "cef"],
    "sulfa": ["sulfamethoxazole", "cotrimoxazole", "co-trimoxazole", "bactrim", "septra", "sulfasalazine"],
    "sulfonamide": ["sulfamethoxazole", "cotrimoxazole", "bactrim", "sulfasalazine"],
    "nsaid": ["ibuprofen", "naproxen", "diclofenac", "ketorolac", "aspirin", "indomethacin", "aceclofenac"],
    "aspirin": ["aspirin", "acetylsalicylic"],
    "macrolide": ["azithromycin", "erythromycin", "clarithromycin"],
    "opioid": ["morphine", "codeine", "tramadol", "fentanyl", "oxycodone"],
}

# Allergy to X implies caution with class Y.
CROSS_REACTIVITY = {
    "penicillin": ["cephalosporin"],
}

# Unordered drug pairs → (severity, explanation).
INTERACTIONS = {
    frozenset({"warfarin", "aspirin"}): ("critical", "markedly increased bleeding risk"),
    frozenset({"warfarin", "ibuprofen"}): ("critical", "increased bleeding risk (NSAID + anticoagulant)"),
    frozenset({"warfarin", "naproxen"}): ("critical", "increased bleeding risk (NSAID + anticoagulant)"),
    frozenset({"warfarin", "clarithromycin"}): ("major", "raises warfarin levels — bleeding risk"),
    frozenset({"aspirin", "ibuprofen"}): ("moderate", "reduced antiplatelet effect + GI bleeding risk"),
    frozenset({"lisinopril", "spironolactone"}): ("major", "risk of hyperkalemia"),
    frozenset({"lisinopril", "potassium"}): ("major", "risk of hyperkalemia"),
    frozenset({"simvastatin", "clarithromycin"}): ("critical", "risk of rhabdomyolysis"),
    frozenset({"trimethoprim", "methotrexate"}): ("critical", "bone marrow suppression"),
    frozenset({"contrast", "metformin"}): ("major", "risk of lactic acidosis with contrast"),
    frozenset({"sertraline", "tramadol"}): ("major", "serotonin syndrome risk"),
    frozenset({"omeprazole", "clopidogrel"}): ("moderate", "reduced antiplatelet effect"),
}


def _normalize(text: str) -> str:
    return (text or "").strip().lower()


def _allergy_conflict(allergen: str, med: str) -> bool:
    """True if a medication conflicts with a (free-text) allergen."""
    allergen = _normalize(allergen)
    med = _normalize(med)
    if not allergen or not med:
        return False
    if allergen in med or med in allergen:
        return True
    matched_classes = [k for k in ALLERGY_CLASSES if k in allergen or allergen in k]
    for cls in matched_classes:
        if any(drug in med for drug in ALLERGY_CLASSES[cls]):
            return True
        for cross in CROSS_REACTIVITY.get(cls, []):
            if any(drug in med for drug in ALLERGY_CLASSES.get(cross, [])):
                return True
    return False


def check_prescription(medication: str, allergies: Optional[str], active_meds: List[str]) -> List[Dict]:
    """Return a list of safety warnings for prescribing `medication`.

    `allergies` is the patient's comma-separated free-text allergy list.
    `active_meds` is the list of the patient's currently-active medication names.
    """
    warnings = []
    med_l = _normalize(medication)

    for allergen in [a for a in (allergies or "").split(",") if a.strip()]:
        if _allergy_conflict(allergen, med_l):
            warnings.append({
                "type": "allergy",
                "severity": "critical",
                "message": f"Patient is allergic to {allergen.strip()} — {medication} is contraindicated.",
            })

    for existing in active_meds:
        ex_l = _normalize(existing)
        if ex_l == med_l:
            warnings.append({
                "type": "duplicate",
                "severity": "moderate",
                "message": f"{medication} is already an active prescription.",
            })
        for pair, (severity, note) in INTERACTIONS.items():
            a, b = tuple(pair)
            if (a in med_l and b in ex_l) or (b in med_l and a in ex_l):
                warnings.append({
                    "type": "interaction",
                    "severity": severity,
                    "message": f"Interaction: {medication} + {existing} — {note}.",
                })
    return warnings


VITAL_RANGES = {
    "heart_rate": {"normal": (60, 100), "critical_low": 40, "critical_high": 130, "unit": "bpm"},
    "systolic_bp": {"normal": (90, 140), "critical_low": 80, "critical_high": 180, "unit": "mmHg"},
    "diastolic_bp": {"normal": (60, 90), "critical_low": 50, "critical_high": 120, "unit": "mmHg"},
    "spo2": {"normal": (95, 100), "critical_low": 90, "critical_high": 101, "unit": "%"},
    "temperature_c": {"normal": (36.0, 37.8), "critical_low": 35.0, "critical_high": 39.0, "unit": "°C"},
    "respiratory_rate": {"normal": (12, 20), "critical_low": 8, "critical_high": 30, "unit": "/min"},
}


def flag_vitals(vitals: dict) -> Dict:
    """Return {field: 'abnormal'|'critical'} for any out-of-range vital sign."""
    flags = {}
    for field, cfg in VITAL_RANGES.items():
        value = vitals.get(field)
        if value is None:
            continue
        low, high = cfg["normal"]
        if value <= cfg["critical_low"] or value >= cfg["critical_high"]:
            flags[field] = "critical"
        elif value < low or value > high:
            flags[field] = "abnormal"
    return flags
