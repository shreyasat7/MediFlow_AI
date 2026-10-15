# MediFlow AI — Complete Feature Documentation

> A full reference to everything the application does — its data model, AI agents,
> electronic health record, roles and access control, clinical safety, deterioration
> scoring, consent, patient portal, billing, interoperability and more. Written so a
> new reader can understand the whole system end to end.

---

## Table of contents

1. [What MediFlow AI is](#1-what-mediflow-ai-is)
2. [Architecture & technology](#2-architecture--technology)
3. [Accounts, login & security](#3-accounts-login--security)
4. [Roles & access control](#4-roles--access-control)
5. [The AI agent pipeline (triage)](#5-the-ai-agent-pipeline-triage)
6. [Patient registration](#6-patient-registration)
7. [Unknown-Patient ("John Doe") emergency mode](#7-unknown-patient-john-doe-emergency-mode)
8. [Patient records & data import](#8-patient-records--data-import)
9. [The patient chart](#9-the-patient-chart)
10. [Clinical safety (decision support)](#10-clinical-safety-decision-support)
11. [NEWS2 deterioration scoring](#11-news2-deterioration-scoring)
12. [Risk-adjusted queue & Ward Rounds (3am view)](#12-risk-adjusted-queue--ward-rounds-3am-view)
13. [Readmission / follow-up risk agent](#13-readmission--follow-up-risk-agent)
14. [Consent & data-sharing ledger](#14-consent--data-sharing-ledger)
15. [AI assistant features](#15-ai-assistant-features)
16. [Patient portal](#16-patient-portal)
17. [Doctors, queue & beds](#17-doctors-queue--beds)
18. [Diagnostics / laboratory](#18-diagnostics--laboratory)
19. [Billing & discharge](#19-billing--discharge)
20. [Appointments](#20-appointments)
21. [Dashboard, Reports, Audit & Coordinator](#21-dashboard-reports-audit--coordinator)
22. [Interoperability — FHIR R4](#22-interoperability--fhir-r4)
23. [The data model](#23-the-data-model)
24. [Honest maturity assessment](#24-honest-maturity-assessment)
25. [Appendix — accounts & demo path](#25-appendix--accounts--demo-path)

---

## 1. What MediFlow AI is

MediFlow AI is a **hospital operations platform and electronic health record (EHR)**. It
combines four things:

- An **AI "agent" layer** that automatically triages and routes patients on arrival.
- A complete **longitudinal medical record** (visits, vitals, diagnoses, medications, notes, tests, bills).
- **Role-based access** so each type of staff sees only what their job needs — and a **read-only patient portal**.
- **Standards-based interoperability** (FHIR R4) plus an **AI assistant** that can reason over a patient's record and the live hospital state.

The core idea: when a patient is registered, a set of AI agents assess and route them in
seconds; from then on every clinical action builds a permanent, auditable record that
authorised staff (and the patient themselves) can look up at any time.

---

## 2. Architecture & technology

| Layer | Technology | Runs at |
|---|---|---|
| **Frontend** | React 19 + Vite, Tailwind CSS, Zustand (state), React Router, Recharts (charts), Framer Motion (animation), lucide-react (icons) | http://localhost:5173 |
| **Backend** | Python **FastAPI** + **SQLAlchemy**, WebSocket for live activity | http://localhost:8000 |
| **Database** | **SQLite** (single file `mediflow.db`) | file on disk |
| **AI** | **Groq** LLM via `langchain_groq` (model `openai/gpt-oss-20b`), with rule-based fallbacks | cloud API |

**Key backend files** (`backend/`): `main.py` (app, seeding, migrations, CORS, WebSocket),
`models/schemas.py` (all database tables), `auth/security.py` (JWT, roles, scoping),
`clinical_safety.py` (drug/allergy/vitals checks), `deterioration.py` (NEWS2), `ai.py`
(Groq helpers + prompts), `fhir.py` (FHIR converters), `patient_import.py` (dataset helper),
and `routers/` (one file per API area). Triage agents live in `agents/`.

**Key frontend files** (`frontend/src/`): `api.js` (single fetch wrapper),
`store/useAuthStore.js` (auth state), `App.jsx` (routing + role guards),
`components/` (AppShell, Sidebar, Navbar, MediBot, ProtectedRoute), `pages/` (one per screen).

**Design note:** the app never depends on the AI being available — if the Groq key is
missing or fails, the triage agents fall back to transparent keyword rules, and the AI
assistant features return a clear "AI not available" message instead of crashing.

---

## 3. Accounts, login & security

- **Login** — staff sign in with a user ID **or** their full name, plus a password. Sessions
  are remembered (JWT stored in the browser) and survive a refresh.
- **Self-signup** — from the login page ("Create account"), a new user picks a role
  (Admin/Doctor/Nurse/Receptionist); doctors also pick a specialization, which adds them to
  the assignable doctor pool.
- **Change password** — any user, from the Account page (click your name, top-right).
- **Brute-force lockout** — 5 failed logins locks the account for 15 minutes (recorded in the audit log).
- **Password & data security:**
  - Passwords are hashed with **bcrypt** (one-way).
  - Sessions use signed **JWT** tokens.
  - **PHI is encrypted at rest** (Fernet) on sensitive Patient fields — contact, date of birth,
    address, insurance ID, emergency contact, allergies, chronic conditions — so the raw
    database file shows ciphertext. (Name is *not* encrypted because it is searched via SQL.)
  - The server **warns on startup** if development-default secrets (JWT secret, Fernet key,
    seed password) are still in use.

---

## 4. Roles & access control

There are **four staff roles plus a patient role**, enforced **on the server**, not just in the menu.

- **Admin** — full access: all patients, staff management, doctors, beds, billing, reports, audit, live monitoring.
- **Doctor** — only their **own assigned patients** and everything related to them (My Patients, their diagnostics/billing/appointments, their dashboard numbers). Cannot see other doctors' patients.
- **Nurse** — patient care: patients, vitals, bed management, diagnostics, ward rounds. No billing, doctor roster or admin tools.
- **Receptionist** — front desk: registration, patient lookup, appointments, billing. No clinical internals or admin tools.
- **Patient** — a read-only portal login scoped to their **own record only** (see §16).

**Per-doctor & per-patient scoping** is applied everywhere in the backend
(`scope_patients` / `authorize_patient`): a Doctor querying patients, billing, diagnostics,
the queue, or the chatbot only ever gets their own patients; a Patient only ever gets their
own record; anything else returns HTTP 403.

### Access at a glance

| Area / Page | Admin | Doctor | Nurse | Receptionist |
|---|---|---|---|---|
| Dashboard (scoped) | ✓ | ✓ | ✓ | ✓ |
| Patients register | ✓ | Own only | ✓ | ✓ |
| Registration | ✓ | — | — | ✓ |
| Patient chart | ✓ | Own only | ✓ | ✓ |
| Ward Rounds | ✓ | ✓ | ✓ | — |
| Diagnostics / Lab | ✓ | Own only | ✓ | — |
| Bed Management | ✓ | — | ✓ | — |
| Billing | ✓ | Own only | — | ✓ |
| Appointments | ✓ | Own only | — | ✓ |
| Doctors & Queue | ✓ | — | — | — |
| Coordinator AI (live) | ✓ | — | — | — |
| Reports & Analytics | ✓ | — | — | — |
| Audit Log | ✓ | — | — | — |
| Staff & Access | ✓ | — | — | — |

---

## 5. The AI agent pipeline (triage)

When a patient is registered, a **Coordinator** runs four specialised agents in sequence,
each making one decision and logging it (stamped with the staff member who registered the
patient). Each agent uses the Groq LLM when available and falls back to rule-based logic
otherwise.

- **Coordinator** — orchestrates the pipeline and writes a log entry for every step.
- **Intake / Triage agent** — reads the symptoms and assigns a **priority** (Emergency / High / Normal)
  and a **recommended specialty**, with a one-line reason. **New:** it also returns a
  **confidence score** and a **runner-up specialty with reasoning** — so you see *why* it chose
  one path over another (reasoning, not just automation).
- **Doctor Assignment agent** — picks the best available doctor: matches the specialty first,
  then the least-busy available doctor; updates that doctor's patient count and marks them Busy at capacity.
- **Diagnostic agent** — suggests 1–3 appropriate tests from a standard set (ECG, Blood Test, X-Ray, CT, MRI, …).
- **Bed Management agent** — allocates a bed (Emergencies prefer ICU, maternity prefers Maternity, else General).

The **Coordinator AI** page (Admin) shows this activity live (see §21).

---

## 6. Patient registration

The registration form (Admin / Receptionist) captures the essentials — **name, age, symptoms**
(required) — plus optional demographics (gender, blood group, DOB, address, contact, emergency
contact, insurance, allergies, chronic conditions). Input is validated (age 0–130, non-blank
name, physiologic vitals bounds).

On submit the AI pipeline runs and a **result panel** shows the assigned **priority, doctor,
bed, suggested tests, triage reason**, and the new **AI reasoning** block (confidence bar +
the runner-up specialty the AI considered but didn't pick). A visit (encounter) is opened
automatically. Every patient gets a permanent, collision-proof ID (e.g. `P-1042`).

---

## 7. Unknown-Patient ("John Doe") emergency mode

Real emergency departments regularly receive **unconscious or unidentified** patients who
can't provide a name, age or history — exactly when fast action matters most. Normal
registration requires those fields; this mode does not.

- A red **"Emergency: Unknown Patient"** button on the Registration page.
- It **bypasses name/age validation**, generates a placeholder name (e.g. `Unknown Male — P-1043`),
  forces priority to **Emergency**, assigns a **trauma/emergency doctor** and an **ICU bed**, and
  opens an emergency encounter — so clinical work and vitals recording can begin immediately.
- The record is flagged **identity-unconfirmed**. Its chart shows an amber **"Identity unconfirmed"**
  banner with a **"Confirm identity"** action that attaches real demographics later and clears the flag.

Built entirely on the existing coordinator, bed and audit infrastructure.

---

## 8. Patient records & data import

- **Patient register** — a searchable, paginated list of all patients (search by **name or
  patient ID**). Doctors see the same view scoped to their own patients ("My Patients").
- **Bulk import** — Admin/Receptionist can upload a JSON file of patients *with history*
  (encounters, vitals, diagnoses, medications, notes) via **Import Patients**; a **Template**
  button downloads the expected format. History items carry dates, so imported patients arrive
  with years of prior visits.
- **Built-in demo dataset** — the app ships with ~30 Indian patients (gendered names, Indian
  cities, +91 contacts, Indian insurers, ₹ billing) each with multi-year histories, plus a
  detailed demo patient **Aarav Menon (P-1031)** — congenital hypothyroidism from birth with
  six linked encounters showing Levothyroxine dose escalation.

---

## 9. The patient chart

Clicking any patient opens their chart — one screen with the entire record across tabs. **Every
chart open is written to the audit log** (who viewed which patient — a core privacy requirement).

**Header:** name, MRN, age/gender/blood group, assigned doctor, coloured **priority/status
pills**, and a **NEWS2 deterioration badge** (see §11). Action buttons: **AI Diagnosis**,
**AI Summary**, **Export FHIR**, and (Admin/Receptionist) **Portal access**.

**Tabs:**
- **Overview** — demographics, insurance, chronic conditions, symptoms; a red banner if the patient has allergies.
- **Vitals** — record temperature/HR/BP/RR/SpO₂/weight/height (impossible values rejected);
  out-of-range readings highlighted amber/red; a **NEWS2 deterioration card** with per-parameter
  breakdown; an HR/BP trend chart once there are ≥2 readings.
- **Diagnoses** — ICD-10-coded diagnoses with status (Active/Resolved), stamped with the clinician.
- **Medications** — prescribe (dose/frequency/duration) with automatic **safety checks** (§10) and stop.
- **Notes** — a timeline of clinical notes (Progress/Nursing/Discharge), attributed to the author.
- **Encounters** — a timeline of visits; **click a visit** to open a detail window showing that
  single visit's reason, treating doctor, diagnoses, medicines, notes and vitals.
- **Tests & Bills** — diagnostic tests (with results) and itemised bills, colour-coded by status.
- **Consent** — the data-sharing ledger (§14).

---

## 10. Clinical safety (decision support)

The system actively prevents dangerous prescribing and flags abnormal readings.

- **Allergy checking with drug families** — a penicillin allergy blocks not just "penicillin"
  but amoxicillin, ampicillin, etc.; also sulfa, NSAIDs, cephalosporins (cross-reactivity).
- **Drug interaction & duplicate checking** — curated pairs (e.g. warfarin + aspirin = critical bleeding risk).
- **Hard-stop with audited override** — a risky prescription is **blocked (HTTP 409)**, not merely
  warned; a clinician can override only by typing a reason, which is permanently recorded as a
  SAFETY_OVERRIDE in the audit log.
- **Vitals range flagging** — abnormal/critical vitals are highlighted on the chart, and critical readings are logged.

---

## 11. NEWS2 deterioration scoring

Every set of vitals is scored with the **National Early Warning Score 2 (NEWS2)** using the
Royal College of Physicians (2017) weightings over the five recorded vital signs (respiratory
rate, SpO₂, temperature, systolic BP, heart rate).

- Each vitals row carries a **score (0–20)**, a **risk band** (Low / Low-Medium / Medium / High)
  and a **per-parameter breakdown** (e.g. `Heart rate 135 (+3)`).
- Shown as a coloured **badge in the chart header** and a **breakdown card in the Vitals tab**.
- The score is a conservative lower bound (consciousness defaults to Alert and oxygen to room
  air since the model doesn't capture them — both only *add* when abnormal), keeping it defensible.

---

## 12. Risk-adjusted queue & Ward Rounds (3am view)

- **Risk-adjusted queue** — the active patient queue is ordered **sickest-first by NEWS2** (then
  priority), rather than by arrival time.
- **Ward Rounds** (Admin/Doctor/Nurse) — a stripped, focused **on-call reading view**: active
  patients as large cards ranked by NEWS2, colour-coded, each with the score, priority, doctor
  and clinical response ("Urgent clinician review", etc.), one click into the chart. Auto-refreshes.

Designed for a clinician under time pressure who needs to see *who is deteriorating* at a glance.

---

## 13. Readmission / follow-up risk agent

A **fifth agent** runs at **discharge** and estimates 30-day readmission risk from transparent
factors: age, chronic-condition burden, number of prior visits, whether a follow-up is booked,
and admission acuity.

- Produces a **Low / Medium / High** band with a score, the contributing factors, and advice
  (e.g. "Arrange follow-up within 7 days").
- Written into the **discharge note** and the **audit log**, and shown to the doctor at the moment of discharge.

---

## 14. Consent & data-sharing ledger

Inspired by India's **Ayushman Bharat Digital Mission (ABDM)** consent model, every patient has
a **Consent tab** recording data-sharing events next to the audit trail:

- **EXPORT** — automatically logged whenever the patient's full record is exported as FHIR.
- **GRANT / DENY** — record a patient's consent decision (with the party/reason).
- **BREAK_GLASS** — record emergency access that bypassed consent, **with a mandatory reason** —
  capturing the exact tension real health-data systems face (patient control vs. emergency access).

Every event is also mirrored to the system-wide Audit Log.

---

## 15. AI assistant features

All AI features use the same Groq key and degrade gracefully if it's missing.

- **AI Diagnosis** — on a chart, generates structured clinical recommendations (likely concerns,
  suggested workup, initial management) from the patient's symptoms, allergies, medications and vitals.
- **AI Summary (grounded)** — generates a chart summary constrained to **only cite numbered
  structured facts** (demographics, diagnoses, active meds, latest vitals, encounter count),
  citing the fact ID behind each statement — so it **cannot hallucinate values**. The modal shows
  the summary plus a **source-facts legend**.
- **MediBot** — a floating chatbot on every page that answers **(a)** general medical questions,
  **(b)** how to use the app, **(c)** questions about the **live hospital data** — patient counts,
  who a doctor is handling, bed status, etc. — **strictly role-scoped** (a Doctor only sees their
  own patients through it; a Patient only their own record). It detects the current patient from
  the URL for context, renders markdown (tables/lists/bold), and offers suggested prompts.

Every AI response carries a "a clinician must confirm" disclaimer.

---

## 16. Patient portal

Patients get a **read-only login** to their own record — turning the system from staff-only tooling
into a complete product.

- **Staff grant access** from the chart header ("Portal access" → set a username + password).
- The patient signs in and sees a dedicated **"My Health"** portal (no staff sidebar): demographics,
  current medications, diagnoses, visit history, bills, upcoming appointments, discharge summary,
  and a **"Download my record (FHIR)"** button.
- **Strictly scoped** — a portal user can only ever see their own patient record; every other
  patient and all staff pages are blocked at the server.

---

## 17. Doctors, queue & beds

- **Doctors & Queue** (Admin) — the full doctor roster with specialty, status and workload;
  "Manage Patients" opens each doctor's **assigned patients** (active queue + past patients),
  clickable into charts, with discharge (which triggers the readmission-risk agent).
- **My Patients** (Doctor) — the doctor's own scoped patient list.
- **Bed Management** (Admin/Nurse) — a ward-by-ward view of beds (Available / Occupied / Cleaning);
  auto-allocated on registration, freed to "Cleaning" on discharge.

---

## 18. Diagnostics / laboratory

A central lab workflow: all diagnostic tests in one queue with patient, test and status; schedule
a new test; advance it through **Pending → In Progress → Ready → Completed** and capture the actual
result value. Every change is recorded with the staff member who made it. The demo dataset is
pre-populated with realistic, condition-matched tests.

---

## 19. Billing & discharge

Discharging a patient automatically produces an **itemised bill** (consultation + each test + meds +
ICU/bed charges), routed to **Insurance** if the patient is insured, else **Pending**. The Billing
page (Admin/Receptionist; Doctors see their own patients' bills) shows the itemised breakdown and
total, and lets you mark a bill **Paid**. A discharge **summary note** is written automatically,
and the **readmission-risk agent** runs.

---

## 20. Appointments

Schedule outpatient/follow-up visits (patient, doctor, department, date/time, reason) and mark them
**Completed** or **Cancelled**. Doctors see only their own appointments; front desk and admin see all;
portal patients see only their own.

---

## 21. Dashboard, Reports, Audit & Coordinator

- **Dashboard** (role-aware) — KPIs (patients, active emergencies, **live average wait time**,
  doctors available), a **real "Visit Volume — recent months"** trend chart, the live agent feed,
  bed occupancy, and the risk-ordered intake queue. Auto-refreshes.
- **Reports & Analytics** (Admin) — KPI tiles, an **auto-generated "Key insights"** section
  (collection rate, outstanding amount, most common condition), plus charts (patients by status/
  priority, revenue by payment status, beds by ward) and a billing breakdown table.
- **Audit Log** (Admin) — a searchable, filterable, chronological record of **every action** — AI
  agent steps, clinical actions, logins/lockouts, safety overrides, consent events, and every
  chart open (PHI access) — each with an **actor** column.
- **Coordinator AI** (Admin) — real-time monitoring of the agents: per-agent counts and a **live
  activity feed over a WebSocket**.

---

## 22. Interoperability — FHIR R4

FHIR (Fast Healthcare Interoperability Resources) is the international standard for exchanging
health data. Mounted at `/fhir` (not under `/api`):

- Endpoints: `metadata` (CapabilityStatement 4.0.1), Patient (read + search), Encounter,
  Observation (vitals & lab results, LOINC-coded with UCUM units), Condition (diagnoses, ICD-10),
  MedicationRequest, AllergyIntolerance, and `Patient/{id}/$everything` (the whole record as one Bundle).
- The chart's **Export FHIR** button (and the portal's "Download my record") download the full
  Bundle as a file — and log an EXPORT consent event.

---

## 23. The data model

Under the hood the record is a set of linked tables (SQLAlchemy → SQLite):

- **Patient** — identity + demographics (sensitive fields encrypted); includes `identity_confirmed` (for John Doe).
- **Encounter** — one per visit; the backbone that ties a visit's events together.
- **Vitals**, **Diagnosis**, **Prescription** (medications), **ClinicalNote** — each linkable to a specific encounter.
- **DiagnosticTest** — lab orders and results.
- **Billing** — itemised bills.
- **Doctor** — the assignable roster (specialty, status, workload).
- **Bed** — wards and bed status.
- **Appointment** — scheduled visits.
- **User** — staff/patient accounts (role, bcrypt hash, lockout state; `patient_id` links portal accounts).
- **AgentLog** — the audit trail, with the **actor** for every action.
- **ConsentEvent** — the consent / data-sharing ledger.

Child clinical records carry a nullable `encounter_id`, which is what powers the per-visit
"encounter detail" view.

---

## 24. Honest maturity assessment

- **As a portfolio / academic project: ~90%** — feature-rich and coherent, with things most
  student EHRs never attempt (server-enforced RBAC, PHI encryption, FHIR, clinical-safety hard-stop,
  agentic triage with explainability, NEWS2, consent ledger, patient portal, grounded AI).
- **As a real, certifiable clinical EHR: ~33%** — the remaining ~two-thirds is regulatory
  certification, production infrastructure (Postgres, TLS, key management, scale, backups),
  clinical validation, and interoperability conformance — measured in person-years, not sprints.
- **Feature depth vs a full production EHR: ~40%** — the skeleton of most areas exists, but depth is
  shallow and some modules are absent (unified CPOE/order sets, e-prescribing + a Medication
  Administration Record, a results inbox with acknowledgment, document/image attachments,
  referrals/care-coordination + tasks, an interactive portal with messaging/self-scheduling, and
  full revenue-cycle billing).

---

## 25. Appendix — accounts & demo path

**Staff accounts** (password `changeme123`): `admin`; doctors `dr.sharma` (Dr. Aarav Sharma),
`dr.rao`, `dr.nair`, `dr.oberoi`, `dr.gupta`, `dr.reddy` (Dr. Karan Reddy), `dr.mehta`,
`dr.kapoor`; `nurse.joy`; `reception.desk`. New users can also self-register.

**Patient portal demo:** `aarav.menon` / `portal123` (Aarav Menon, P-1031).

**Strongest demo path:** log in as **admin** → Patients → open **Aarav Menon (P-1031)** →
Vitals (NEWS2) → Encounters (click a visit) → **AI Diagnosis** / **AI Summary** → **Consent** tab →
**MediBot** (ask "how many patients?", "who handles Aarav Menon?"). Then Registration →
**Emergency: Unknown Patient** → open its chart → **Confirm identity**. Then **Ward Rounds**. Finally
log in as **`dr.sharma`** to show per-doctor scoping, and **`aarav.menon`/`portal123`** for the portal.
