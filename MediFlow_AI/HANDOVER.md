# MediFlow AI — URGENT Handover: Code Recovery + Full Project Reference

> **READ THIS ENTIRE FILE FIRST in the new chat.** The project's application code
> reverted to an old state on disk (cause unknown — not a normal git operation).
> This doc has (1) the #1 recovery lead to try immediately, (2) full context on
> what happened, (3) a complete feature/file reference to rebuild by hand if
> recovery fails. Last updated: 2026-08-18, mid-emergency, context ran out.

---

## 0. DO THIS FIRST — the recovery lead (Python bytecode cache)

**Critical finding:** `MediFlow_AI/backend/__pycache__/` and `MediFlow_AI/backend/routers/__pycache__/`
and `MediFlow_AI/backend/auth/__pycache__/` still contain **compiled `.pyc` files
from Aug 12–13 2026** for modules that no longer exist as `.py` source files.
Python compiles source to bytecode on import and caches it — these caches
**were not deleted** even though the source files were. This means the
backend logic (though not the exact original formatting/comments) may be
**recoverable by decompiling these `.pyc` files.**

**Files confirmed present in cache (dated Aug 12–13, i.e. from the missing work), with NO corresponding `.py` source on disk:**

`MediFlow_AI/backend/__pycache__/`:
- `ai.cpython-314.pyc` (Aug 13 14:39) — no `backend/ai.py` exists
- `clinical_safety.cpython-314.pyc` (Aug 4 22:02) — no `backend/clinical_safety.py` exists
- `crypto.cpython-314.pyc` (Aug 11 11:01) — no `backend/crypto.py` exists
- `fhir.cpython-314.pyc` (Aug 11 10:48) — no `backend/fhir.py` exists
- `patient_import.cpython-314.pyc` (Aug 13 09:40) — no `backend/patient_import.py` exists

`MediFlow_AI/backend/routers/__pycache__/`:
- `ai.cpython-314.pyc` (Aug 13 14:30) — no `routers/ai.py` exists
- `appointments.cpython-314.pyc` (Aug 12 15:42) — no `routers/appointments.py` exists
- `auth.cpython-314.pyc` (Aug 12 15:23) — no `routers/auth.py` exists (⚠️ note: there IS a `routers/auth.py`? verify — check this first)
- `clinical.cpython-314.pyc` (Aug 12 15:23) — no `routers/clinical.py` exists
- `fhir.cpython-314.pyc` (Aug 12 15:23) — no `routers/fhir.py` exists

`MediFlow_AI/backend/auth/__pycache__/`:
- `security.cpython-314.pyc` (Aug 12 15:23) — no `auth/security.py` exists
- `__init__.cpython-314.pyc` (Aug 4 10:00) — no `auth/__init__.py` confirmed exists or not, check

**NOTE:** `main.py`, `beds.py`, `billing.py`, `diagnostics.py`, `doctors.py`, `patients.py`,
`system.py` also have `.pyc` files dated **Aug 18 10:38** — those are recompiles of the
CURRENT (reverted/old) `.py` source, not useful for recovery. Only trust `.pyc` files
whose source `.py` is confirmed MISSING and whose date is Aug 4–13.

**How to attempt decompilation (try in this order):**

```bash
cd /Users/krishdhumal/Desktop/EHR/MediFlow_AI/backend
source venv/bin/activate   # or use ./venv/bin/pip below directly

# Option A: decompyle3 (good for 3.8-3.10, may not fully support 3.14 bytecode)
./venv/bin/pip install decompyle3
./venv/bin/decompyle3 __pycache__/ai.cpython-314.pyc

# Option B: pycdc (C++ decompiler, broader version support, needs separate build)
# brew install pycdc   (if available via homebrew tap) OR build from
# https://github.com/zrax/pycdc

# Option C: uncompyle6 (older, unlikely to support 3.14, try anyway)
./venv/bin/pip install uncompyle6
./venv/bin/uncompyle6 __pycache__/ai.cpython-314.pyc

# Option D: manual disassembly fallback (always works, but gives bytecode not
# source — useful only to VERIFY logic/strings while hand-rewriting the file)
./venv/bin/python -c "
import dis, marshal, importlib.util
with open('__pycache__/ai.cpython-314.pyc','rb') as f:
    f.read(16)  # skip the pyc header (magic+flags+timestamp+size, py3.7+)
    code = marshal.load(f)
dis.dis(code)
"
```

**Python 3.14 is very new (released ~Oct 2025), so mainstream decompilers
(decompyle3/uncompyle6) likely DO NOT support its bytecode format yet.**
If all decompilers fail, fall back to Option D (disassembly) just to recover
**exact string literals** (system prompts, error messages, regex patterns,
table names) that are otherwise expensive to reconstruct from memory, then
hand-rewrite the file using the detailed spec in Section 4 below.

**Do this check FIRST, before spending time on decompilation:** verify which
`.py` files are ACTUALLY missing right now (the routers/auth.py note above is
uncertain) — this list may have changed since it was captured:

```bash
cd /Users/krishdhumal/Desktop/EHR/MediFlow_AI/backend
ls auth/*.py routers/*.py *.py 2>&1
```

**Also check the frontend for an equivalent build cache** (not yet checked —
do this in the new session):
```bash
cd /Users/krishdhumal/Desktop/EHR/MediFlow_AI/frontend
ls -la node_modules/.vite 2>&1        # Vite's dep-cache, unlikely to have app source
ls -la dist 2>&1                       # a prior production build, IF one was ever run,
                                        # would contain bundled (minified) JS with your
                                        # logic inside — extractable but minified/hard to read
find . -maxdepth 3 -newer package.json -name "*.jsx" 2>&1  # any jsx newer than reverted files?
```
Vite dev mode (`npm run dev`) does NOT write a persistent on-disk cache of your
own source files (only of `node_modules` deps), so frontend recovery via cache
is unlikely — but check `dist/` in case a production build was ever run.

---

## 1. What happened (best understanding)

Sometime around **Aug 14, 2026 ~20:38–20:39**, the file contents of
`MediFlow_AI/backend/` and `MediFlow_AI/frontend/` on disk reverted to an
**earlier state** — roughly the state from before most of this project's
work (before Phase 0). This is NOT a normal `git checkout`/`reset` — git
history only has one commit (`fcc19d7 "Updated v2"`, timestamp today's
region) with no reflog/stash prior to it, and GitHub (`origin/main`, repo
`KrishDhumal/EHR_V2`) also only has that same old commit. The user does not
recall making a copy or reverting anything. Root cause is unknown.

**What survived intact:**
- **`MediFlow_AI/backend/mediflow.db`** (SQLite) — completely intact. Confirmed via
  direct SQL queries: 31 patients, all 14 tables (agent_logs, alembic_version,
  appointments, beds, billing, clinical_notes, diagnoses, diagnostic_tests,
  doctors, encounters, patients, prescriptions, users, vitals), the `actor`
  column on `agent_logs`, `failed_attempts`/`locked_until` on `users`, all
  professional doctor accounts + nurse.joy + reception.desk + several
  self-signup test accounts (1234, 123444, 333, recep.test).
- **`.pyc` bytecode caches** for several deleted backend modules (see Section 0).
- The user's **memory of every feature** (relayed to me across a very long prior
  conversation) — captured in full detail in Section 4 below and in
  `~/.claude/projects/-Users-krishdhumal-Desktop-EHR/memory/mediflow-ehr-roadmap.md`
  (a persistent memory file — READ THIS FILE, it has a phase-by-phase log written
  contemporaneously as each feature was built, likely more complete than this doc).

**What was lost (as .py/.jsx source, confirmed missing from disk as of Aug 18):**
- Backend: `auth/security.py`, `ai.py`, `clinical_safety.py`, `crypto.py`,
  `fhir.py`, `patient_import.py`, `seed_dataset.py`, `seed_special_patient.py`,
  `routers/ai.py`, `routers/appointments.py`, `routers/clinical.py`, `routers/fhir.py`.
  `routers/auth.py` may or may not exist — VERIFY, don't assume.
  `main.py`, `beds.py`, `billing.py`, `diagnostics.py`, `doctors.py`,
  `patients.py`, `system.py`, `models/schemas.py` all reverted to old/simpler
  versions (no auth deps, no role checks, no actor param, old Doctor/AgentLog
  schema without new columns).
  No `alembic/versions/*.py` migration files confirmed (check).
  No `tests/` files.
- Frontend: `Login.jsx` (old had no signup), `Patients.jsx`, `PatientChart.jsx`,
  `MyPatients.jsx`, `Appointments.jsx`, `Reports.jsx`, `AuditLog.jsx`, `Staff.jsx`,
  `Account.jsx`, `ProtectedRoute.jsx`, `ErrorBoundary.jsx`, `MediBot.jsx`,
  `useAuthStore.js` (reverted to old `useUserStore.js`). `Coordinator.jsx`,
  `doctors.py`/`beds.py` (backend) confirmed reverted via system reminders
  during this session — treat as representative of the whole revert, not
  as isolated cases.
- Root-level docs: `HANDOVER.md` (a prior version of this very file — gone),
  `PROJECT_CHANGES.md`, `FEATURE_DOCUMENTATION.docx`, `TESTING_GUIDE.docx`
  all missing (I regenerate this file now; the others need to be redone too
  if wanted, lower priority).

**Action already taken this session:** none — every command run was read-only
(git status/log/reflog/fetch/ls-remote, `ls`, `cat`, `sqlite3 SELECT` queries,
reading the memory file, listing `__pycache__`). **No files were modified or
deleted by me.** The keychain password prompt the user saw was macOS asking
to unlock a saved GitHub credential for a `git fetch` — harmless, unrelated
to the data loss, the user can Deny/cancel it if unwanted since fetch already
completed its check (GitHub confirmed to only have the old commit).

---

## 2. Recommended recovery order for the new session

1. **Section 0 first** — attempt `.pyc` decompilation for the backend modules
   listed. Even partial/garbled output is useful to cross-check against
   Section 4's spec while hand-rewriting.
2. **Read the memory file**:
   `~/.claude/projects/-Users-krishdhumal-Desktop-EHR/memory/mediflow-ehr-roadmap.md`
   — it has a detailed, phase-by-phase description of exactly what was built,
   written as it happened. Treat it as more authoritative than this doc for
   backend logic specifics (exact function names, endpoint paths, column names).
3. **Ask the user directly, again, whether a second Claude Code session/tab is
   still open somewhere** with the newer files in its own sandbox/worktree —
   this was asked once but the user got distracted by the GitHub investigation
   and didn't give a final answer. This is still worth 30 seconds to confirm
   before doing a full manual rebuild.
4. **If no recovery source works**, rebuild by hand using Section 4 below,
   in this priority order (each layer depends on the previous):
   1. `models/schemas.py` (full schema — see 4.1) — must match what's already
      in `mediflow.db`, or use Alembic/manual ALTER to reconcile.
   2. `auth/security.py` + `routers/auth.py` (login/RBAC foundation).
   3. `crypto.py` (needed by schemas.py's encrypted columns).
   4. `clinical_safety.py`, `routers/clinical.py` (patient chart backend).
   5. `patient_import.py`, `seed_dataset.py`, `seed_special_patient.py` (get
      the Indian dataset + Aarav Menon back — though the DB rows may already
      exist, just re-verify against Section 4.7).
   6. `fhir.py`, `routers/fhir.py`.
   7. `ai.py`, `routers/ai.py` (AI Diagnosis + MediBot backend).
   8. `routers/appointments.py`.
   9. Re-apply the router-level auth/role changes to `beds.py`, `billing.py`,
      `diagnostics.py`, `doctors.py`, `patients.py`, `system.py`, `main.py`
      (these files exist but are the OLD unprotected versions — need the
      RBAC/scoping logic re-added, not created from scratch).
   10. Frontend: `useAuthStore.js`, `api.js` updates, `ProtectedRoute.jsx`,
       `ErrorBoundary.jsx`, then pages in this order: `Login.jsx` → `App.jsx`
       routing → `Sidebar.jsx`/`Navbar.jsx` → `Patients.jsx`/`PatientChart.jsx`
       → `MyPatients.jsx` → `Staff.jsx`/`Account.jsx` → `Appointments.jsx`/
       `Reports.jsx`/`AuditLog.jsx` → `Coordinator.jsx` (live WS version) →
       `MediBot.jsx`.
   11. Rebuild `tests/` last (nice-to-have, not blocking).
5. **After rebuild, run the test suite** (once tests exist) and manually
   verify against the feature list in Section 4 — the user will want to
   confirm everything actually works again, not just compiles.

---

## 3. Environment / run commands (unchanged, still accurate)

```bash
# Backend — MUST cd into backend AND use the venv (Anaconda `(base)` is
# often active in the user's shell and will crash on `dotenv` import otherwise).
cd /Users/krishdhumal/Desktop/EHR/MediFlow_AI/backend
./venv/bin/uvicorn main:app --reload --port 8000
# If port 8000 busy: lsof -ti tcp:8000 | xargs kill

# Frontend (second terminal)
cd /Users/krishdhumal/Desktop/EHR/MediFlow_AI/frontend
npm run dev          # first time: npm install (fixes "vite: command not found")
```
Backend: FastAPI + SQLAlchemy + SQLite (`mediflow.db`), port 8000.
Frontend: React 19 + Vite + Tailwind + Zustand + React Router + Recharts +
Framer Motion, port 5173.
AI: Groq via `langchain_groq.ChatGroq`, model `llama-3.1-8b-instant`, key in
`backend/.env` as `GROQ_API_KEY` (still present, confirmed `gsk_...` prefix).
**This key is considered leaked (was hardcoded early on, in git history) —
user was advised to rotate at console.groq.com; unknown if they did.**

**Accounts** (all password `changeme123` unless changed):
`admin`; doctors `dr.sharma`, `dr.rao`, `dr.nair`, `dr.oberoi`, `dr.gupta`,
`dr.reddy`, `dr.mehta`, `dr.kapoor`; `nurse.joy`; `reception.desk`. Confirmed
still present in the DB's `users` table (queried directly via sqlite3).

**⚠️ Root-level duplicate folders exist and are STALE/UNUSED — do not confuse
with the real app:** `/Users/krishdhumal/Desktop/EHR/backend`,
`/Users/krishdhumal/Desktop/EHR/frontend`, and a stray root `/venv`. The
REAL app is always under `/Users/krishdhumal/Desktop/EHR/MediFlow_AI/`.

---

## 4. Full feature specification (rebuild reference)

This is the complete, detailed record of what was built, for hand-reconstruction.
Cross-reference with the memory file (`mediflow-ehr-roadmap.md`) which has
overlapping but independently-written detail — use both.

### 4.1 Data model (`models/schemas.py`)
Tables (all confirmed still present in `mediflow.db` — schema.py must match):
- **Patient**: id, patient_id (unique, format `P-{1000+id}`), name, age,
  symptoms, priority (Emergency/High/Normal), status (Waiting/In Treatment/
  Discharged/etc.), assigned_doctor, created_at. Plus richer fields added in
  Phase 1: date_of_birth, gender, blood_group, address, contact,
  emergency_contact_name, emergency_contact_phone, insurance_provider,
  insurance_id, allergies, chronic_conditions.
  **Encrypted-at-rest** (via `crypto.py`'s `EncryptedString` SQLAlchemy
  TypeDecorator, Fernet-based) on: contact, date_of_birth, address,
  emergency_contact_name, emergency_contact_phone, insurance_id, allergies,
  chronic_conditions. NOT encrypted: name (it's searched via SQL LIKE),
  insurance_provider, gender, blood_group, age, priority, status.
- **Encounter**: id, patient_id (FK), encounter_type, reason, attending_doctor,
  status (Open/Closed), created_at, closed_at.
- **Vitals**: id, patient_id (FK), encounter_id (FK, nullable), temperature_c,
  heart_rate, systolic_bp, diastolic_bp, respiratory_rate, spo2, weight_kg,
  height_cm, recorded_by, recorded_at.
- **ClinicalNote**: id, patient_id (FK), encounter_id (FK, nullable),
  note_type (Progress/Nursing/Discharge), author, content, created_at.
- **Diagnosis**: id, patient_id (FK), encounter_id (FK, nullable), code
  (ICD-10, nullable), description, status (Active/Resolved), diagnosed_by,
  created_at.
- **Prescription**: id, patient_id (FK), encounter_id (FK, nullable),
  medication, dosage, frequency, duration, status (Active/Stopped),
  prescribed_by, created_at.
- **DiagnosticTest**: id, patient_id (FK, nullable — pre-registration tests
  use a placeholder), patient_name, test_name, status (Pending/In Progress/
  Ready/Completed), result (nullable, added Phase 3), created_at.
- **Billing**: id, patient_id (FK), items (JSON or delimited string of line
  items), total (int/float — ₹ amounts), payment_status (Pending/Paid/
  Insurance), created_at.
- **Doctor**: id, name (full name, e.g. "Dr. Aarav Sharma"), specialization,
  status (Available/Busy/Off-Duty), current_patient_count.
- **Bed**: id, bed_number, ward, status (Available/Occupied/Cleaning),
  patient_id (nullable FK, who's occupying it).
- **User**: id, username (unique), full_name, hashed_password (bcrypt),
  role (Admin/Doctor/Nurse/Receptionist), is_active (bool),
  failed_attempts (int, default 0), locked_until (datetime, nullable),
  created_at.
- **AgentLog**: id, agent_name (e.g. "Intake", "Coordinator", "Access",
  "AI Assist"), action_type (e.g. TRIAGE, RECOMMEND, LOCKOUT, VIEW), message,
  **actor** (nullable — the username/full_name of who triggered it, added in
  the access-model redesign), created_at.
- **Appointment**: id, patient_id (FK), doctor_id or doctor_name, scheduled_for
  (datetime), status (Scheduled/Completed/Cancelled), notes, created_at.

### 4.2 Auth & RBAC (`auth/security.py`, `routers/auth.py`)
- `hash_password`/`verify_password` — bcrypt via `passlib` or `bcrypt` lib directly.
- `create_access_token`/`decode_access_token` — JWT via `python-jose` or `pyjwt`,
  `JWT_SECRET` env var (dev default warned at startup), expiry ~24h.
- `get_current_user` — FastAPI dependency, decodes bearer token, loads User
  from DB, raises 401 if invalid/missing.
- `require_roles(*roles)` — dependency factory, raises 403 if
  `current_user.role not in roles`.
- **`scope_patients(query, current_user)`** — takes a SQLAlchemy query on
  Patient, filters to `Patient.assigned_doctor == current_user.full_name` if
  role is Doctor, else returns unfiltered. Applied to patients list/queue/chart,
  billing, diagnostics, appointments, kpis.
- **`authorize_patient(patient, current_user)`** — raises 403 if role is
  Doctor and `patient.assigned_doctor != current_user.full_name`. Applied
  wherever a single patient is fetched by ID across chart/clinical/discharge/
  FHIR endpoints.
- Login lockout: on failed login, increment `failed_attempts`; at 5, set
  `locked_until = now + 15min` and return 423; successful login resets
  `failed_attempts` to 0.
- Routes in `routers/auth.py`: `POST /login`, `POST /register` (public
  self-signup — creates User + if role==Doctor also creates a matching Doctor
  pool row keyed by full_name), `GET /me`, `POST /change-password`,
  `GET /users` (Admin), `POST /users` (Admin, admin-created accounts),
  `DELETE /users/{id}` (Admin, cannot self-delete; if deleting a Doctor with
  assigned patients set their Doctor pool row to Off-Duty instead of deleting
  it, else delete the pool row too), `PATCH /users/{id}/deactivate` or similar
  (Admin, cannot self-deactivate), `POST /users/{id}/reset-password` (Admin).

### 4.3 AI features (`ai.py`, `routers/ai.py`) — mounted at `/api/ai`
- `ai.py`: wraps `ChatGroq`. **CRITICAL BUG FIX APPLIED**: must read
  `GROQ_API_KEY`/`GROQ_MODEL` **lazily inside functions** (e.g. via a
  `_key()`/`_model()` helper called at call-time), NOT captured as a module-level
  constant at import time — because `load_dotenv()` runs in `main.py` AFTER
  the routers (and thus `ai.py`) are imported, so a module-level read would
  always see an empty string. Default model `llama-3.1-8b-instant`.
- `POST /api/ai/recommend/{patient_id}` — roles Admin/Doctor/Nurse, doctor
  scoped via `authorize_patient`. Builds a prompt from the patient's symptoms,
  allergies, chronic conditions, active medications, vitals history. System
  prompt instructs the model to give a structured clinical recommendation
  (e.g. headed sections: possible considerations, suggested workup,
  suggested initial management) with a disclaimer that a clinician must
  confirm. Logs to AgentLog as agent_name="AI Assist", action_type="RECOMMEND",
  actor=current_user.full_name. Returns 503 gracefully if no GROQ_API_KEY set.
- `POST /api/ai/chat` — any authenticated user. Body: `{message, patient_id?}`.
  If `patient_id` given, calls `authorize_patient` first (so a Doctor can't
  leak another doctor's patient via chat) and includes patient context
  (symptoms/history summary) in the prompt. System prompt: "MediBot", a
  medical assistant that answers (a) general medical questions and (b) how to
  use MediFlow AI, refusing unrelated topics, always including a
  confirm-with-a-clinician disclaimer for clinical content. Returns
  `{reply: string}`. Also 503 gracefully if no key.

### 4.4 Clinical safety (`clinical_safety.py`)
- Allergy cross-reactivity checking: a curated map of drug-class relationships
  (e.g. penicillin ↔ cephalosporin cross-reactivity, sulfa drugs, NSAIDs) —
  checks a new prescription's drug/class against the patient's `allergies`
  field (free text, matched via keyword/substring).
- Drug-drug interaction checking: curated pairs of interacting drug classes.
- Duplicate therapy checking: same drug already Active for this patient.
- Adult vitals range flagging: reasonable normal ranges for temperature,
  heart rate, BP, spo2, respiratory rate — returns which fields are outside
  range (used to flag "CRITICAL" AgentLog entries and highlight in UI).
- The prescribe endpoint (in `routers/clinical.py`) calls this and, if any
  warnings triggered, returns **HTTP 409** with body
  `{"detail": {"message": ..., "warnings": [...]}}`. The frontend must then
  show these warnings and let the user resubmit with `override: true` and
  an `override_reason` string; the backend logs this as AgentLog
  action_type="SAFETY_OVERRIDE" with the reason and actor, then allows the
  prescription through. There's also a `POST .../prescriptions/safety-check`
  pre-flight endpoint that runs the same checks without creating anything
  (GET-style, used by frontend to check before final submit).

### 4.5 Patient chart backend (`routers/clinical.py`)
Mounted under `/api/patients/{patient_id}/...` (or similar prefix — verify
against `main.py`'s router include). Endpoints, all requiring
`authorize_patient` for the given patient_id:
- `GET /chart` — the main aggregate endpoint. Returns everything for the
  patient: demographics, all encounters (each with nested/linked vitals,
  notes, diagnoses, prescriptions filtered by encounter_id — this powers the
  "click an encounter to see its detail" modal), tests, bills. Also writes an
  AgentLog entry agent_name="Access", action_type="VIEW" (audit trail of who
  viewed which patient's chart — a compliance feature) with actor=current_user.
- `POST /vitals` — role Admin/Doctor/Nurse. Runs vitals range flagging;
  logs CRITICAL if any out-of-range.
- `POST /notes` — role Admin/Doctor/Nurse.
- `POST /diagnoses` — role Admin/Doctor.
- `POST /prescriptions` — role Admin/Doctor. Runs `clinical_safety` checks
  (see 4.4), 409-blocks unless overridden.
- `PATCH /prescriptions/{id}/stop` — sets status=Stopped.
- Validation via Pydantic: patient age must be 0–130, name non-blank
  (Phase 1 validators), vitals values must be within physiologic bounds
  (module-level `VITAL_BOUNDS` dict, e.g. temp 30-45°C, HR 20-250, etc.) —
  Pydantic v2 field_validators, invalid input returns 422 with array-shaped
  detail (frontend's `apiFetch` must format arrays specially).

### 4.6 FHIR (`fhir.py`, `routers/fhir.py`) — mounted at `/fhir` (NOT under `/api`!)
- `fhir.py`: pure converter functions, ORM object → FHIR R4 JSON dict.
  Patient→Patient resource, Encounter→Encounter, Vitals→Observation
  (LOINC-coded: heart_rate→8867-4, systolic/diastolic BP→8480-6/8462-4,
  temperature→8310-5, spo2→59408-5, etc., with UCUM units), Diagnosis→
  Condition (with ICD-10 coding if present), Prescription→MedicationRequest,
  allergies (free text field, split on comma)→AllergyIntolerance resources.
- `routers/fhir.py`: `GET /fhir/metadata` (CapabilityStatement, fhirVersion
  "4.0.1"), `GET /fhir/Patient/{id}`, `GET /fhir/Patient?...search`,
  `GET /fhir/Encounter?patient=...`, `GET /fhir/Observation?patient=...`,
  `GET /fhir/Condition?patient=...`, `GET /fhir/MedicationRequest?patient=...`,
  `GET /fhir/AllergyIntolerance?patient=...`, and the flagship
  **`GET /fhir/Patient/{id}/$everything`** returning a full FHIR Bundle
  (type "document") with every resource for that patient. Auth required
  (any logged-in user, doctor-scoped via authorize_patient).
- Frontend: `originUrl()` helper in `api.js` strips the `/api` suffix from
  `API_BASE` to build `/fhir/...` URLs (since apiFetch normally prefixes
  `/api`). "Export FHIR" button on `PatientChart.jsx` header, downloads
  `{patient_id}-fhir-bundle.json`.

### 4.7 Dataset seeding & import (`patient_import.py`, `seed_dataset.py`, `seed_special_patient.py`)
- `patient_import.create_patient_with_history(db, patient_dict)` — shared
  helper. Takes a dict with top-level patient fields plus a nested
  `encounters: [...]` list; each encounter dict can itself nest `vitals`,
  `notes`, `diagnoses`, `medications` lists — items nested INSIDE an
  encounter get that encounter's `encounter_id` set (this is what powers
  the encounter-detail modal); items NOT nested (top-level on the patient)
  stay `encounter_id=None`. Honors explicit `date`/`created_at` fields on
  each item so imported/seeded data can have realistic historical
  timestamps spanning years.
- `seed_dataset.py` — generates ~30 Indian patients: gendered Indian first
  names (separate MALE_FIRST/FEMALE_FIRST lists so name+gender always agree),
  Indian surnames, Indian cities, +91 phone format, Indian insurers (e.g.
  Star Health, HDFC Ergo), ₹ billing amounts. Each patient gets multiple
  years of encounter history. Run via `./venv/bin/python seed_dataset.py`
  (skips seeding if patient count already ≥40 — idempotent guard) or
  `--reset` flag to wipe and rebuild. **IMPORTANT BUG FIX applied**: the
  `reset()` function must explicitly delete from ALL child tables
  (Prescription, Diagnosis, ClinicalNote, Vitals, Encounter, Billing,
  DiagnosticTest, then Patient) — a bare bulk `query.delete()` on Patient
  alone does NOT cascade in SQLAlchemy and leaves orphaned child rows that
  then incorrectly attach to newly-seeded patients reusing the same
  autoincrement IDs. Also frees/resets any Beds pointing at deleted patients.
- `seed_special_patient.py` — creates **"Aarav Menon"**, patient_id likely
  `P-1031` (verify — was P-1031 as of last check, but IDs may shift after
  any reset), a demo patient with **Congenital Hypothyroidism present from
  birth**, under doctor "Dr. Karan Reddy". Has **6 detailed encounters**
  from 2018 (birth) through 2025, each with linked vitals/diagnosis/note/
  medication, showing his Levothyroxine dose escalating over time as he
  grows (a good demo of the per-encounter linked history + the
  click-to-expand encounter modal).
- `POST /api/patients/import` (Admin/Receptionist only, 403 for other roles)
  — body `{"patients": [...]}`, bulk-loads via `create_patient_with_history`.
  Frontend: `Patients.jsx` has an **"Import Patients"** button (file picker,
  reads a JSON file, POSTs it) and a **"Template"** button (downloads a
  sample JSON showing the expected shape) — both visible only to
  Admin/Receptionist.

### 4.8 Frontend structure & conventions
- `src/api.js`: `API_BASE` (env `VITE_API_URL`, default probably
  `http://127.0.0.1:8000/api`), `apiFetch(path, opts)` wrapper — attaches
  `Authorization: Bearer <token>` from `useAuthStore`, handles 401 (logout +
  redirect), formats 422 Pydantic validation error ARRAYS into readable
  strings, formats the special 409 safety-check error shape
  `{detail:{message,warnings}}`. `wsUrl()` and `originUrl()` helpers for
  the WebSocket and `/fhir` endpoints respectively (both bypass the `/api`
  prefix apiFetch normally adds).
- `src/store/useAuthStore.js` — Zustand store, persists `{token, user}` to
  `localStorage`, replaced an older `useUserStore.js` (which the reverted
  code has brought back — must be swapped again).
- `src/components/ProtectedRoute.jsx` — route guard, checks token presence
  and optionally a role allowlist prop, redirects to `/login` if unauthenticated.
- `src/components/ErrorBoundary.jsx` — class component, catches render errors
  app-wide, wraps the router in `App.jsx`.
- `src/components/MediBot.jsx` — the floating AI chatbot. Fixed-position
  circular button bottom-right, expands to a chat panel. Mounted once in
  `AppShell.jsx` so it's present on every authenticated page. Uses
  `useLocation()` (react-router) to detect if current path matches
  `/patients/:id` and auto-includes that `patient_id` in chat requests for
  context. Has message history state, a **"New" button** (uses a `SquarePen`
  icon from lucide-react) that resets the conversation back to just the
  welcome message. Calls `POST /api/ai/chat`. Renders **bold** markdown and
  preserves newlines in replies (simple regex-based renderer, not a full
  markdown lib).
- `src/pages/Login.jsx` — has a toggle between Login and Signup forms (not
  two separate routes). Signup form: full_name, username, password, role
  select, specialization select (shown only if role===Doctor). Old reverted
  version has neither signup nor these fields.
- `src/pages/Patients.jsx` — searchable/paginated list, row click →
  navigates to `/patients/:id` (the chart). Admin/Receptionist see Import/
  Template buttons.
- `src/pages/MyPatients.jsx` — Doctor-only, same list UI but backend
  already scopes results via `scope_patients`, so no extra frontend filtering
  needed, just a Doctor-specific route/page.
- `src/pages/PatientChart.jsx` — THE big page. Tabs: Overview, Vitals
  (chart/graph of trends), Diagnoses, Medications (prescribe form with
  safety-check flow), Notes, **Encounters (list of visit cards; clicking one
  opens a modal showing that encounter's linked vitals/notes/diagnoses/
  medications — filtered client-side by encounter_id from the /chart
  response)**, Tests & Bills. Header has **"AI Diagnosis"** button (calls
  `POST /api/ai/recommend/{id}`, shows result in a modal) and **"Export
  FHIR"** button (calls `GET /fhir/Patient/{id}/$everything` via
  `originUrl()`, triggers a JSON file download).
- `src/pages/Staff.jsx` — Admin only. List of all users with role/status,
  create-user form, delete/deactivate/reset-password actions per row.
- `src/pages/Account.jsx` — any user, change-your-own-password form,
  reachable via clicking your name in `Navbar.jsx`.
- `src/pages/Appointments.jsx`, `Reports.jsx`, `AuditLog.jsx` — built in
  Phase 4, standard CRUD/list pages, role-gated (Reports/Audit = Admin only,
  Appointments = broader).
- `src/pages/Coordinator.jsx` — **the LIVE version** (not the old decorative
  fake-topology one, which is what's currently reverted-in). The live
  version connects to a WebSocket at `/ws/activity` (token passed as a
  query param since browsers can't set custom headers on WS handshakes) and
  additionally polls `GET /system/agent-stats` for a fallback/initial
  snapshot, showing a real-time feed of AgentLog entries as they're created
  system-wide. Admin only.
- `src/components/Sidebar.jsx` — nav items filtered by `user.role`, roughly:
  Admin sees everything; Doctor sees Dashboard/My Patients/Diagnostics(own)/
  Appointments(own)/Billing(own) — NOT Beds, NOT the Doctors roster, NOT
  Coordinator/Reports/Audit/Staff/Registration; Nurse sees Patients/Vitals/
  Beds/Diagnostics — NOT Billing/Doctors roster/admin tools; Receptionist
  sees Registration/Patients/Appointments/Billing — NOT clinical
  internals/admin tools.
- `src/pages/Dashboard.jsx` — role-aware: Doctor's dashboard shows only
  their own patient counts/queue (backend scoping handles this
  automatically via the same `/api/patients` and stats endpoints); Admin's
  dashboard additionally shows the live agent feed, patient-flow chart, and
  bed-occupancy chart which lower roles don't see/need.

### 4.9 Other backend routers needing RBAC re-applied
These files EXIST on disk right now but are the OLD unprotected versions —
they need role checks and (where relevant) `scope_patients`/`authorize_patient`
calls re-added, not full rewrites:
- `routers/beds.py` — old version has no auth import at all (confirmed via
  system reminder this session). Needs: `Depends(get_current_user)` on GET,
  `require_roles("Admin","Nurse")` on the PATCH status-update endpoint.
- `routers/doctors.py` — old version has no auth (confirmed). The full
  doctor roster listing should probably be Admin-only or at least
  authenticated; individual doctors shouldn't see competitors' workload
  details necessarily — verify against memory notes for exact policy, but
  at minimum require login.
- `routers/billing.py`, `routers/diagnostics.py`, `routers/patients.py`,
  `routers/system.py`, `main.py` — all need the auth dependency, role
  checks, and where patient-specific, `authorize_patient`/`scope_patients`
  calls re-integrated per the policy in 4.2. `main.py` specifically also
  needs: CORS config, the `_run_lightweight_migrations()`-style startup
  hook OR proper Alembic wiring (whichever was last true — memory file says
  Alembic was configured, initial migration `74146e8e1d08`, but check if
  `alembic/versions/` still has that file on disk — likely also reverted/gone),
  the WebSocket `/ws/activity` endpoint, and the SEED_DOCTORS +
  idempotent user/doctor seeding logic in the startup event (so re-running
  the app doesn't wipe/duplicate the existing 31 patients / doctor accounts
  already in `mediflow.db`).
- `models/database.py` — check `DATABASE_URL` handling (memory says it
  reads from an env var, defaulting to the existing `mediflow.db` — do
  NOT accidentally point it at a fresh/different file, the real data is in
  the existing `mediflow.db` in the backend folder).

### 4.10 Test suite (`tests/`)
Memory indicates ~43 pytest tests existed across files: `test_auth_rbac.py`
(or similar), `test_role_scoping.py`, `test_import.py`, `test_ai.py`
(4 tests, verifying auth requirement / role requirement / 503-without-key
behavior for the AI endpoints), plus tests for clinical safety, FHIR, and
security/validation. Lower priority to rebuild — functionality first,
tests after, per Section 2's ordering.

---

## 5. User context & working preferences

- User: Krish. Building this as an academic "Specialisation Project" —
  cares about it looking and behaving like professional software, wants
  honest assessments of production-readiness (was told ~25-30% toward a
  real certifiable clinical EHR, but a strong 85-90% as a portfolio/academic
  project — the missing 70% is compliance/certification/infra-scale/
  clinical-breadth/validation, not more demo features).
- Wants sample/demo data to be **Indian** (names, cities, ₹ currency, +91
  phone format) — already reflected in `seed_dataset.py`'s design, preserve
  this if rebuilding.
- Previously asked for and received three Word documents (via a `docx` npm
  script, generated in a scratchpad dir then written to the repo root):
  `PROJECT_CHANGES.md`+`.docx` (plain-language change summary),
  `TESTING_GUIDE.docx` (step-by-step test-each-feature guide),
  `FEATURE_DOCUMENTATION.docx` (complete 16-section, ~59-feature reference
  with an access-control matrix). All three are currently MISSING from disk
  (only the source `.md` may partially survive — check). Regenerating these
  is lower priority than getting the app itself working again, but the user
  may ask for them again once the app is restored. **Most recently, the
  user asked for a short "handout" doc splitting the presentation into 4
  people's parts for a class presentation to their teacher — this was
  interrupted by the discovery of the code-loss issue and was NOT
  delivered.** Revisit this once the app works again — it's a real
  outstanding request.
- Strongest demo path (for the class presentation, once restored): log in
  as admin → Patients → open **Aarav Menon (P-1031)** → Encounters tab
  (click a visit to show the detail modal) → **AI Diagnosis** button →
  open **MediBot** (floating bot, bottom-right, on every page) → log out,
  log in as `dr.sharma` to demonstrate per-doctor data scoping (they should
  NOT see Aarav or other doctors' patients).
- User does not want the AI to fabricate or guess — be transparent about
  uncertainty, e.g. whether decompilation will actually work on Python 3.14
  bytecode (genuinely uncertain, mainstream tools may not support it yet).
- **docx generation notes** (if redoing the Word docs later): `docx` npm
  package is NOT preinstalled — must `npm install docx` in a scratch dir
  first. Neither `pandoc` nor LibreOffice (`soffice`) are installed on this
  Mac — verify generated `.docx` files via `textutil -convert txt` and
  `qlmanage -t` (macOS Quick Look thumbnail) instead of trying to convert
  to PDF for visual review.

---

## 6. Immediate next message for the new session

Suggested first message to send in the fresh chat:
> "Read HANDOVER.md in MediFlow_AI/ (repo root). Start with Section 0 — try
> to decompile the .pyc files. Then read the memory file
> mediflow-ehr-roadmap.md. Then tell me what you can recover automatically
> vs what needs manual rebuilding, and let's get the app working again
> before revisiting the 4-person presentation handout."
