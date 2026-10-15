"""
Doctor Assignment Agent - Picks the best available doctor based on specialization and workload.
"""
import os
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def run_doctor_assignment_agent(patient_name: str, symptoms: str, recommended_specialization: str, available_doctors: list) -> dict:
    """
    Given a list of available doctors and patient info, pick the best doctor.
    Returns: { doctor_name, doctor_id, reason }
    """
    if not available_doctors:
        return {"doctor_name": None, "doctor_id": None, "reason": "No doctors available."}

    # Filter by specialization first, then fall back to General
    matching = [d for d in available_doctors if d["specialization"] == recommended_specialization and d["status"] == "Available"]
    if not matching:
        matching = [d for d in available_doctors if d["status"] == "Available"]
    if not matching:
        matching = available_doctors  # last resort: take any

    # Sort by lowest patient count (least busy)
    matching_sorted = sorted(matching, key=lambda d: d.get("current_patient_count", 0))
    best_doctor = matching_sorted[0]

    if GROQ_API_KEY and len(matching_sorted) > 1:
        try:
            llm = ChatGroq(model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"), api_key=GROQ_API_KEY, temperature=0, max_tokens=512)
            doctor_list = "\n".join([f"- {d['name']} | {d['specialization']} | {d['current_patient_count']} patients | {d['status']}" for d in matching_sorted[:5]])
            messages = [
                SystemMessage(content="You are a hospital coordinator. Pick the best doctor for the patient from the list. Respond ONLY with JSON: {\"doctor_name\": \"...\", \"reason\": \"one sentence\"}"),
                HumanMessage(content=f"Patient: {patient_name}\nSymptoms: {symptoms}\nNeed: {recommended_specialization}\n\nDoctors:\n{doctor_list}")
            ]
            response = llm.invoke(messages)
            import json
            result = json.loads(response.content.strip())
            # Find doctor id by name
            matched = next((d for d in matching_sorted if d["name"] == result.get("doctor_name")), best_doctor)
            return {"doctor_name": matched["name"], "doctor_id": matched["id"], "reason": result.get("reason", "Best match."), "source": "groq_llm"}
        except Exception as e:
            print(f"[DoctorAgent] Groq failed, using fallback: {e}")

    return {
        "doctor_name": best_doctor["name"],
        "doctor_id": best_doctor["id"],
        "reason": f"Assigned {best_doctor['name']} ({best_doctor['specialization']}) — least busy available doctor.",
        "source": "rule_based"
    }
