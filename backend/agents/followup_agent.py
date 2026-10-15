"""Discharge / Follow-up Risk Agent — estimates 30-day readmission risk.

Deliberately simple, transparent rules (not ML): patient age, chronic-condition
burden, prior-visit history, whether follow-up is arranged, and admission acuity.
Enough to flag who needs proactive follow-up, and every factor is auditable.
"""


def assess_readmission(patient, visit_count: int, has_followup: bool) -> dict:
    factors = []
    score = 0

    age = patient.age or 0
    if age >= 65:
        score += 2
        factors.append("Age 65 or over")
    elif age >= 50:
        score += 1
        factors.append("Age 50–64")

    if (patient.chronic_conditions or "").strip():
        score += 2
        factors.append(f"Chronic condition(s): {patient.chronic_conditions}")

    if visit_count >= 4:
        score += 2
        factors.append(f"Frequent attender ({visit_count} visits)")
    elif visit_count >= 2:
        score += 1
        factors.append(f"Multiple prior visits ({visit_count})")

    if not has_followup:
        score += 1
        factors.append("No follow-up appointment booked")

    if patient.priority == "Emergency":
        score += 1
        factors.append("Emergency admission")

    band = "High" if score >= 5 else "Medium" if score >= 3 else "Low"
    advice = {
        "High": "Arrange follow-up within 7 days; consider care-coordinator referral.",
        "Medium": "Book a follow-up appointment before discharge.",
        "Low": "Routine discharge advice.",
    }[band]
    return {"score": score, "band": band, "factors": factors, "advice": advice}
