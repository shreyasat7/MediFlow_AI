"""Shared Groq LLM helpers for the AI assistant features.

Uses the same GROQ_API_KEY the triage agents use. Degrades gracefully: if no
key is configured the callers return a clear "AI not available" response
instead of crashing.
"""
import os

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage


def _key():
    # Read lazily (NOT at import) — load_dotenv() runs after this module is imported.
    return os.getenv("GROQ_API_KEY", "")


def _model():
    return os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


DISCLAIMER = "AI decision support — informational only. A qualified clinician must confirm before acting."

RECOMMEND_SYSTEM = (
    "You are a clinical decision-support assistant for hospital staff. Given a patient's presentation, "
    "give concise, practical guidance in short headed sections:\n"
    "1. Likely concerns — differential considerations to rule out.\n"
    "2. Recommended checks / investigations — exams and tests to order.\n"
    "3. Initial management — first steps and symptomatic treatment, including example medication classes "
    "and typical doses where appropriate.\n"
    "Base advice strictly on the symptoms and history given. Respect the patient's allergies and current "
    "medications (never suggest something they're allergic to or that dangerously interacts). Do NOT give a "
    "definitive diagnosis. Keep under ~220 words. End with a one-line reminder that a clinician must confirm."
)

APP_GUIDE = (
    "About the MediFlow AI app (use this for 'how do I' questions):\n"
    "- Register a patient: Registration page (Admin/Receptionist) — enter name, age, symptoms; the AI "
    "auto-assigns priority, doctor, tests and a bed.\n"
    "- Find a patient / see history: Patients page → search → click a patient to open their chart. Doctors "
    "use 'My Patients'.\n"
    "- Patient chart tabs: Overview, Vitals, Diagnoses, Medications, Notes, Encounters (click a visit for its "
    "detail), Tests & Bills. An 'AI Diagnosis' button gives symptom-based recommendations; 'Export FHIR' "
    "downloads the record.\n"
    "- Prescribe/record: Medications, Vitals, Diagnoses, Notes tabs (safety checks block unsafe drugs).\n"
    "- Other pages: Diagnostics (lab), Bed Management, Billing, Appointments, Reports, Audit Log, Staff & "
    "Access (admin). Roles: Admin sees all; Doctor sees only their patients; Nurse handles care/vitals/beds; "
    "Receptionist handles front desk.\n"
    "- Import patient data: Patients page → 'Import Patients' (Admin/Receptionist) with a JSON file."
)

CHAT_SYSTEM = (
    "You are MediBot, a medical assistant embedded in the MediFlow AI hospital system. You help clinical staff "
    "with (a) general medical questions — conditions, medications, dosing, first aid, guidelines — and (b) how "
    "to use the MediFlow AI application. Be accurate, concise and professional. If patient context is provided "
    "below, use it to answer questions about that patient. For clinical questions, note when something needs a "
    "clinician's judgement. Politely decline requests that are not medical or not about this application.\n\n"
) + APP_GUIDE


def available() -> bool:
    return bool(_key())


def _llm(max_tokens: int, temperature: float) -> ChatGroq:
    return ChatGroq(model=_model(), api_key=_key(), temperature=temperature, max_tokens=max_tokens, timeout=30)


def ask(system: str, turns, max_tokens: int = 500, temperature: float = 0.3) -> str:
    """turns: list of (role, content) with role in {'user','assistant'}."""
    messages = [SystemMessage(content=system)]
    for role, content in turns:
        messages.append(
            AIMessage(content=content) if role == "assistant" else HumanMessage(content=content)
        )
    response = _llm(max_tokens, temperature).invoke(messages)
    return (response.content or "").strip()
