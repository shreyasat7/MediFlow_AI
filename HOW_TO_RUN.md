# 🏥 MediFlow AI — How to Run the Project

## What's been added / changed
- ✅ **4 Real AI Agents** in `backend/agents/` (Intake, Doctor, Diagnostic, Bed)
- ✅ **Coordinator Agent** that runs all agents in sequence on registration
- ✅ **Registration page** now calls the real backend (not fake setTimeout)
- ✅ **Dashboard** now shows live data — queue, KPIs, agent logs, bed occupancy
- ✅ **Groq LLM integration** — add your free key to get real AI reasoning
- ✅ **Fallback** — works without Groq key using smart rule-based logic

---

## STEP 1 — Get a FREE Groq API Key (5 minutes)

1. Go to **https://console.groq.com**
2. Sign up (free, no credit card needed)
3. Click **"Create API Key"** → copy the key
4. Inside `backend/` folder, create a file called `.env`:

```
GROQ_API_KEY=your_actual_key_here
```

> ⚠️ If you skip this, the agents still work using rule-based logic. Groq just makes them smarter.

---

## STEP 2 — Run the Backend (FastAPI)

Open a terminal in VS Code, navigate to the backend folder:

```bash
cd MediFlow_AI/backend
```

Install dependencies (first time only):

```bash
pip install -r requirements.txt
```

Start the server:

```bash
uvicorn main:app --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Test it: Open **http://127.0.0.1:8000/docs** in your browser — you'll see all API endpoints.

---

## STEP 3 — Run the Frontend (React)

Open a **second terminal** in VS Code:

```bash
cd MediFlow_AI/frontend
npm install     # first time only
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in 300ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## STEP 4 — Test the AI Agent Pipeline

1. Log in with any role (Admin, Doctor, etc.)
2. Go to **Patient Registration**
3. Fill in a patient name, age, and symptoms like:
   - `"chest pain and difficulty breathing"` → should get **Emergency**
   - `"high fever and headache"` → should get **High**
   - `"mild cold and runny nose"` → should get **Normal**
4. Click Submit
5. Watch the result card — you'll see:
   - Priority assigned by Intake Agent
   - Doctor assigned by Doctor Agent
   - Tests suggested by Diagnostic Agent
   - Bed assigned (for Emergency/High)
6. Go to **Dashboard** — the queue and agent activity feed update live!

---

## Project Structure (what each file does)

```
backend/
├── agents/
│   ├── intake_agent.py      ← Uses Groq LLM to analyze symptoms & assign priority
│   ├── doctor_agent.py      ← Picks best available doctor by specialization + workload
│   ├── diagnostic_agent.py  ← Suggests tests (ECG, MRI, Blood Test etc.)
│   ├── bed_agent.py         ← Assigns bed based on priority (ICU for Emergency)
│   └── coordinator.py       ← MAIN BRAIN: runs all 4 agents in sequence
├── routers/
│   ├── patients.py          ← POST /api/patients/ triggers full agent pipeline
│   ├── system.py            ← GET /api/system/kpis and /logs for dashboard
│   └── ...
├── models/
│   ├── schemas.py           ← Database table definitions
│   └── database.py          ← SQLite connection
├── main.py                  ← FastAPI app entry point
└── .env                     ← Your GROQ_API_KEY goes here (create this file)

frontend/src/
├── pages/
│   ├── Registration.jsx     ← Calls real backend, shows full agent results
│   ├── Dashboard.jsx        ← Live data: queue, KPIs, logs, bed occupancy
│   └── ...
└── ...
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: langchain_groq` | Run `pip install langchain-groq` |
| `CORS error` in browser | Make sure backend is running on port 8000 |
| `Cannot connect to backend` | Check `uvicorn` is running in terminal |
| Dashboard shows no data | Register a patient first, then refresh |
| Groq gives error | Check your `.env` file has the correct key |

---

## For your examiner demo

1. Start both servers
2. Open the dashboard — show it's empty/live
3. Register an Emergency patient (chest pain symptoms)
4. Show the result card — 4 agents ran in sequence
5. Go to Dashboard — queue updated, agent feed shows all agent actions with timestamps
6. Explain: "Each agent is a separate Python module using LangChain + Groq LLM..."
