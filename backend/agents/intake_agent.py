"""
Patient Intake Agent - Uses Groq LLM to analyze symptoms and assign priority.
Falls back to a comprehensive rule-based logic if Groq key is not set.

Returns a primary decision PLUS a confidence and the runner-up specialty, so the
UI can show *why* the AI chose one path over another (reasoning, not automation).
"""
import os
import json
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SYSTEM_PROMPT = """You are a hospital triage AI agent. Analyze the patient's symptoms and assign a priority level and specialty.

Rules:
- EMERGENCY: Chest pain, difficulty breathing, unconscious, severe bleeding, stroke symptoms, heart attack, trauma, stab wound, gunshot, active labor, hemorrhage, seizure
- HIGH: High fever (>102F), moderate pain, fracture, vomiting blood, severe headache, allergic reaction, accident, concussion
- NORMAL: Mild fever, cold/flu, minor cuts, routine checkup, mild pain, sprain

Respond with ONLY a JSON object in this exact format, nothing else:
{
  "priority": "Emergency" | "High" | "Normal",
  "reason": "one sentence explanation",
  "recommended_specialization": "Cardiology" | "Neurology" | "Orthopedics" | "Pediatrics" | "Maternity" | "Emergency" | "General",
  "confidence": 0.0-1.0,
  "alternatives": [ {"specialization": "<the next most likely specialty>", "confidence": 0.0-1.0, "reason": "why this was the runner-up"} ]
}"""

SPECIALTY_KW = {
    "Maternity": ["pregnant", "pregnancy", "maternity", "labor", "contraction", "water broke", "prenatal"],
    "Pediatrics": ["child", "baby", "kid", "infant", "toddler", "pediatric"],
    "Cardiology": ["heart", "chest", "pulse", "palpitation", "cardiac", "blood pressure", "arrhythmia"],
    "Neurology": ["headache", "stroke", "unconscious", "dizzy", "nerve", "brain", "head", "hemorrhage", "seizure", "numbness", "paralysis"],
    "Orthopedics": ["bone", "broken", "fracture", "accident", "leg", "arm", "knee", "joint", "back pain", "spine", "sprain", "muscle", "hip"],
}

EMERGENCY_KW = [
    "chest pain", "heart attack", "can't breathe", "difficulty breathing", "unconscious",
    "severe bleeding", "stroke", "trauma", "not breathing", "stab", "gunshot", "choking",
    "poison", "labor", "hemorrhage", "seizure", "overdose",
]
HIGH_KW = [
    "fever", "fracture", "vomiting blood", "severe headache", "allergic", "high temperature",
    "cut", "bleeding", "broken", "accident", "head injury", "concussion", "burn",
]


def run_intake_agent(patient_name: str, age: int, symptoms: str) -> dict:
    if GROQ_API_KEY:
        try:
            llm = ChatGroq(
                model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
                api_key=GROQ_API_KEY,
                temperature=0,
                max_tokens=512,
            )
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=f"Patient: {patient_name}, Age: {age}\nSymptoms: {symptoms}"),
            ]
            result = json.loads(llm.invoke(messages).content.strip())
            result.setdefault("confidence", 0.8)
            result.setdefault("alternatives", [])
            result["source"] = "groq_llm"
            return result
        except Exception as e:
            print(f"[IntakeAgent] Groq failed, using fallback: {e}")

    return _rule_based_triage(symptoms)


def _rule_based_triage(symptoms: str) -> dict:
    s = (symptoms or "").lower()

    # Priority
    if any(k in s for k in EMERGENCY_KW):
        priority, reason = "Emergency", "Life-threatening condition or active trauma detected."
    elif any(k in s for k in HIGH_KW):
        priority, reason = "High", "Symptoms require prompt medical attention."
    else:
        priority, reason = "Normal", "Symptoms are non-critical. Routine care recommended."

    # Specialty scoring — count keyword hits per specialty.
    scores = {spec: sum(1 for k in kws if k in s) for spec, kws in SPECIALTY_KW.items()}
    ranked = sorted(scores.items(), key=lambda x: -x[1])
    top_spec, top_score = ranked[0]
    second_spec, second_score = ranked[1]

    if top_score == 0:
        # Nothing matched a specialty — route trauma to the ER, else General.
        if priority == "Emergency" and any(k in s for k in ["stab", "gunshot", "trauma", "bleeding", "poison", "overdose"]):
            spec, confidence = "Emergency", 0.7
            alt = {"specialization": "General", "confidence": 0.4, "reason": "No organ-specific signs; ER by default."}
        else:
            spec, confidence = "General", 0.5
            alt = {"specialization": "Emergency" if priority == "Emergency" else "General",
                   "confidence": 0.35, "reason": "Symptoms did not map to a specialty."}
    else:
        spec = top_spec
        confidence = round(min(0.95, 0.55 + 0.15 * top_score), 2)
        if second_score > 0:
            alt = {"specialization": second_spec,
                   "confidence": round(confidence * (second_score / (top_score + second_score)), 2),
                   "reason": f"Also matched {second_score} sign(s) for {second_spec}."}
        else:
            alt = {"specialization": "General", "confidence": round((1 - confidence) * 0.6, 2),
                   "reason": "Weak secondary signal; general medicine as backup."}

    return {
        "priority": priority,
        "reason": reason,
        "recommended_specialization": spec,
        "confidence": confidence,
        "alternatives": [alt],
        "source": "rule_based",
    }
