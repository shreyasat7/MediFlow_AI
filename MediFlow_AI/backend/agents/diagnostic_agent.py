"""
Diagnostic Agent - Suggests required medical tests based on patient symptoms.
Uses Groq LLM if available, otherwise rule-based.
"""
import os
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SYSTEM_PROMPT = """You are a medical diagnostic AI agent. Based on the patient's symptoms, suggest 1-3 appropriate diagnostic tests.
Choose from: Blood Test, Urine Test, X-Ray, MRI, CT Scan, ECG, Ultrasound, CBC (Complete Blood Count), Blood Pressure Check, Glucose Test

Respond ONLY with a JSON array like: ["ECG", "Blood Test"]
No explanation, just the JSON array."""


def run_diagnostic_agent(patient_name: str, symptoms: str, priority: str) -> list:
    """
    Suggest diagnostic tests for a patient based on symptoms.
    Returns a list of test names.
    """
    if GROQ_API_KEY:
        try:
            llm = ChatGroq(model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"), api_key=GROQ_API_KEY, temperature=0, max_tokens=512)
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=f"Patient: {patient_name}, Priority: {priority}\nSymptoms: {symptoms}")
            ]
            response = llm.invoke(messages)
            import json
            tests = json.loads(response.content.strip())
            return tests if isinstance(tests, list) else []
        except Exception as e:
            print(f"[DiagnosticAgent] Groq failed, using fallback: {e}")

    return _rule_based_tests(symptoms, priority)


def _rule_based_tests(symptoms: str, priority: str) -> list:
    s = symptoms.lower()
    tests = []

    if any(k in s for k in ["chest", "heart", "palpitation"]):
        tests.extend(["ECG", "Blood Test"])
    if any(k in s for k in ["head", "dizzy", "faint", "neuro", "vision"]):
        tests.append("CT Scan")
    if any(k in s for k in ["bone", "fracture", "joint", "knee", "arm", "leg"]):
        tests.append("X-Ray")
    if any(k in s for k in ["fever", "infection", "pain"]):
        tests.append("CBC (Complete Blood Count)")
    if any(k in s for k in ["urine", "kidney", "urinary"]):
        tests.append("Urine Test")
    if any(k in s for k in ["abdomen", "stomach", "liver", "abdominal"]):
        tests.append("Ultrasound")
    if any(k in s for k in ["sugar", "glucose", "diabetes"]):
        tests.append("Glucose Test")

    if not tests:
        tests = ["Blood Test", "Blood Pressure Check"]

    if priority == "Emergency" and "ECG" not in tests:
        tests.insert(0, "ECG")

    return list(dict.fromkeys(tests))[:3]  # deduplicate, max 3
