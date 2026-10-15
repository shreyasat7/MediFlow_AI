import sqlite3, random, json
from datetime import datetime, timedelta
random.seed(42)
c = sqlite3.connect('mediflow.db'); cur = c.cursor()

# Tests keyed loosely to symptoms/diagnoses
TEST_POOL = {
    'cardio': [('ECG', 'Sinus rhythm, no acute ST changes', 900), ('Troponin I', '0.02 ng/mL (normal)', 1200),
               ('Lipid Profile', 'LDL 130 mg/dL, HDL 42 mg/dL', 800), ('Echocardiogram', 'EF 60%, no wall motion abnormality', 3500)],
    'neuro':  [('CT Head', 'No acute intracranial abnormality', 4500), ('MRI Brain', 'No focal lesion', 8000),
               ('EEG', 'No epileptiform activity', 2500)],
    'ortho':  [('X-Ray', 'No fracture or dislocation', 700), ('MRI Joint', 'Mild degenerative changes', 7000)],
    'general':[('CBC (Complete Blood Count)', 'Hb 13.2, WBC 7.8k, Platelets 240k', 500),
               ('Blood Sugar (Fasting)', '96 mg/dL (normal)', 300), ('Urine Routine', 'No abnormality detected', 250),
               ('Thyroid Profile', 'TSH 2.4 mIU/L (normal)', 700)],
    'peds':   [('TSH', '3.1 mIU/L', 700), ('CBC (Complete Blood Count)', 'Age-appropriate values', 500)],
}
def bucket(text):
    t = (text or '').lower()
    if any(w in t for w in ['chest','cardiac','heart','hyperten','palpit']): return 'cardio'
    if any(w in t for w in ['head','seiz','neuro','stroke','migraine','dizz']): return 'neuro'
    if any(w in t for w in ['fracture','joint','bone','back','knee','ortho']): return 'ortho'
    if any(w in t for w in ['child','thyroid','pediatric','hypothyroid']): return 'peds'
    return 'general'

INSURERS_PAID_RATE = 0.55
patients = cur.execute("SELECT patient_id, name, symptoms, status, insurance_provider, created_at, assigned_doctor FROM patients").fetchall()
dx_by_pat = {}
for pid, desc in cur.execute("SELECT patient_id, description FROM diagnoses"):
    dx_by_pat.setdefault(pid, []).append(desc or '')

ntests = nbills = 0
for pid, name, symptoms, status, insurer, created, doctor in patients:
    hint = (symptoms or '') + ' ' + ' '.join(dx_by_pat.get(pid, []))
    b = bucket(hint)
    pool = TEST_POOL[b] + random.sample(TEST_POOL['general'], 1)
    k = random.randint(1, 3)
    chosen = random.sample(pool, min(k, len(pool)))
    base_dt = created or datetime.utcnow().isoformat()
    test_total = 0
    for i, (tname, result, cost) in enumerate(chosen):
        # Most completed; leave ~1 in a pending/ready state for the active patient
        if status != 'Discharged' and i == len(chosen)-1:
            st, res = random.choice([('Pending', None), ('In Progress', None), ('Ready', None)])
        else:
            st, res = 'Completed', result
        cur.execute("INSERT INTO diagnostic_tests (patient_id, patient_name, test_name, status, result, requested_at) VALUES (?,?,?,?,?,?)",
                    (pid, name, tname, st, res, base_dt))
        test_total += cost
        ntests += 1
    # Bill: consultation + tests + a meds charge
    meds_charge = random.choice([0, 350, 500, 800, 1200])
    items = ['Doctor Consultation (Rs. 500)'] + [f'{t[0]} (Rs. {t[2]})' for t in chosen]
    if meds_charge: items.append(f'Pharmacy / Medications (Rs. {meds_charge})')
    total = 500 + test_total + meds_charge
    if insurer:
        pay = 'Insurance' if random.random() < 0.7 else ('Paid' if random.random() < 0.6 else 'Pending')
    else:
        pay = 'Paid' if random.random() < INSURERS_PAID_RATE else 'Pending'
    if status != 'Discharged':
        pay = 'Pending'
    cur.execute("INSERT INTO billing (patient_id, patient_name, items, total_amount, payment_status, issued_at) VALUES (?,?,?,?,?,?)",
                (pid, name, ', '.join(items), total, pay, base_dt))
    nbills += 1

c.commit()
print(f"Seeded {ntests} diagnostic tests and {nbills} bills.")
print("  test statuses:", dict(cur.execute("SELECT status, COUNT(*) FROM diagnostic_tests GROUP BY status").fetchall()))
print("  bill statuses:", dict(cur.execute("SELECT payment_status, COUNT(*) FROM billing GROUP BY payment_status").fetchall()))
print("  total revenue: Rs.", cur.execute("SELECT SUM(total_amount) FROM billing").fetchone()[0])
