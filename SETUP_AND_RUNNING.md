# MediFlow AI — Setup & Running Guide

> How to get the project running from scratch on a new machine, how to share it with
> your team, and how to share the database. Read this before your first run.

---

## 1. Prerequisites

Install these first:

- **Python 3.11 or newer** (3.12 / 3.13 recommended). Check: `python3 --version`
- **Node.js 18 or newer** (comes with `npm`). Check: `node --version`
- A **Groq API key** (free) for the AI features — get one at https://console.groq.com
  *(the app works without it, but AI Diagnosis / AI Summary / MediBot / LLM triage will be disabled).*

The project has two parts, each in its own folder:

```
MediFlow_AI/
  backend/    ← Python FastAPI server (port 8000)
  frontend/   ← React app (port 5173)
```

---

## 2. Get the project

**Option A — clone from GitHub (recommended):**
```bash
git clone -b recovery/restore-from-bytecode https://github.com/KrishDhumal/EHR_V2.git
cd EHR_V2/MediFlow_AI
```
*(GitHub does not include `mediflow.db` or `.env` — see §7 and §8 to add them.)*

**Option B — from a zip:** unzip it, then `cd` into the `MediFlow_AI` folder.
Do **not** expect a zipped `venv/` or `node_modules/` to work — always rebuild them (below).

---

## 3. Backend setup (first time only)

```bash
cd MediFlow_AI/backend

# create a fresh virtual environment
python3 -m venv venv

# install dependencies
./venv/bin/pip install -r requirements.txt
```

> **Windows:** use `python -m venv venv` then `venv\Scripts\pip install -r requirements.txt`.

---

## 4. Set the AI key (`.env`)

Create a file named `.env` inside `backend/` with:

```
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

- Get the key at https://console.groq.com (free).
- Without this file the app still runs; AI features just show "AI is not configured".
- **Do not commit `.env` to git** — it's already gitignored.

---

## 5. Frontend setup (first time only)

```bash
cd MediFlow_AI/frontend
npm install
```

---

## 6. Run the app (every time)

Open **two terminals**.

**Terminal 1 — backend:**
```bash
cd MediFlow_AI/backend
./venv/bin/uvicorn main:app --reload --port 8000
```
> **Windows:** `venv\Scripts\uvicorn main:app --reload --port 8000`
> **Important (macOS/Anaconda users):** always call `./venv/bin/uvicorn` (the venv binary),
> not a bare `uvicorn`. If your shell has Anaconda `(base)` active, a bare `uvicorn` grabs the
> wrong Python and crashes on `dotenv`.

**Terminal 2 — frontend:**
```bash
cd MediFlow_AI/frontend
npm run dev
```

Then open **http://localhost:5173**.

The backend creates/uses `backend/mediflow.db`, seeds the default doctors, staff and beds on
first run, and applies any small schema updates automatically.

---

## 7. First login

Default password for all staff: **`changeme123`**

| User ID | Role |
|---|---|
| `admin` | Admin (sees everything) |
| `dr.sharma`, `dr.rao`, `dr.nair`, `dr.oberoi`, `dr.gupta`, `dr.reddy`, `dr.mehta`, `dr.kapoor` | Doctors |
| `nurse.joy` | Nurse |
| `reception.desk` | Receptionist |

You can also log in with a full name (e.g. `Dr. Aarav Sharma`) instead of the user ID, or
create a new account from the login page.

**Patient portal demo (only if you shipped the database):** `aarav.menon` / `portal123`.

**If the database is empty** (fresh clone, no `mediflow.db`): you'll have the doctors, staff and
beds but **no patients**. To load the demo dataset, from `backend/` run:
```bash
./venv/bin/python seed_dataset.py          # ~30 Indian patients with history
./venv/bin/python seed_special_patient.py  # Aarav Menon (P-1031)
./venv/bin/python seed_tests_bills.py       # diagnostic tests + bills for those patients
```

---

## 8. Sharing the project with your team

**A plain zip of the whole folder will not run on a teammate's machine** — the `venv/` (~129 MB)
and `node_modules/` (~197 MB) are built for *your* computer and won't work elsewhere. Ship the
code, not those folders.

**Make a clean zip** (excludes the non-portable folders, keeps your code and data):
```bash
cd /Users/krishdhumal/Desktop/EHR
zip -r mediflow_ai.zip MediFlow_AI \
  -x "*/venv/*" "*/node_modules/*" "*/__pycache__/*" "*/.DS_Store"
```

Each teammate then does §3 (`python -m venv venv` + `pip install`), §5 (`npm install`), and §6 (run).

Two things to decide before sending:
- **Include `.env`?** Yes → AI works immediately but you share your Groq key. No → each person adds
  their own key (§4). For a trusted team, including it is fine.
- **Include `mediflow.db`?** Yes (recommended) → they get all 31 patients + the portal demo login
  instantly. No → they start empty and must run the seeders (§7).

---

## 9. How to share the database

The entire database is a **single file**: `backend/mediflow.db` (~330 KB). To share it, just
send that one file; the teammate drops it into their `backend/` folder (replacing any existing
one) and restarts the server. That's it — no import step.

**One caveat — encryption keys must match.** Sensitive patient fields (contact, address, DOB,
insurance ID, emergency contact, allergies, chronic conditions) are **encrypted** in the database.
They are encrypted with the **Fernet key**, which by default is a fixed built-in "dev" key used
whenever no `FERNET_KEY` is set in `.env`. So:

- If **nobody sets `FERNET_KEY`** (the normal case), the same built-in key is used on every
  machine, and the shared database decrypts perfectly everywhere. ✅
- If a teammate has set a **different** `FERNET_KEY` in their `.env`, those encrypted fields
  **won't decrypt** (they'll look like garbled text). Fix: either remove `FERNET_KEY` from their
  `.env`, or make sure everyone uses the *same* `FERNET_KEY`.

*(Non-encrypted data — names, diagnoses, medications, bills, etc. — always reads fine regardless.)*

**To reset to a clean demo database:** delete `backend/mediflow.db`, restart the server (recreates
the doctors/staff/beds), then run the three seeders from §7.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `[Errno 48] Address already in use` (port 8000) | Something is already running there: `lsof -ti tcp:8000 \| xargs kill` (macOS/Linux). |
| `vite: command not found` | Run `npm install` in `frontend/` first. |
| Backend crashes on `dotenv` / wrong Python | Use `./venv/bin/uvicorn …`, not a bare `uvicorn`. Deactivate Anaconda `(base)` if active. |
| AI features say "AI is not configured" (503) | No/blank `GROQ_API_KEY` — add it to `backend/.env` (§4) and restart. |
| AI features say "AI request failed" (502) | The Groq key is invalid/revoked, or the model name is wrong — check `GROQ_MODEL=openai/gpt-oss-20b`. |
| Shared DB shows garbled contact/address | Fernet key mismatch — see §9 (remove or align `FERNET_KEY`). |
| A page flashes blank for a second | Just a fade-in animation; it fills in. |
| Port 5173 busy | `lsof -ti tcp:5173 \| xargs kill`, or Vite will offer another port. |

---

**See also:** `FEATURE_DOCUMENTATION.md` (what every part of the app does) and, for the story of
how the codebase was recovered, `HANDOVER.md`.
