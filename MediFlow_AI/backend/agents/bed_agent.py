"""
Bed Management Agent - Assigns a bed based on patient priority, symptoms, and available beds.
"""

def run_bed_agent(priority: str, symptoms: str, available_beds: list) -> dict:
    """
    Assign a bed to a patient based on priority and symptoms.
    Emergency -> ICU preferred
    Maternity Symptoms -> Maternity preferred
    Normal/High -> General
    """
    if not available_beds:
        return {"bed_id": None, "bed_number": None, "ward": None, "reason": "No beds currently available."}

    # Filter only available beds
    free_beds = [b for b in available_beds if b["status"] == "Available"]
    if not free_beds:
        return {"bed_id": None, "bed_number": None, "ward": None, "reason": "All beds are currently occupied."}

    symptoms_lower = symptoms.lower()
    
    # 1. Smart Routing: Check for Maternity
    if "pregnan" in symptoms_lower or "labor" in symptoms_lower or "maternity" in symptoms_lower or "baby" in symptoms_lower:
        preferred = [b for b in free_beds if b["ward"] == "Maternity"]
        if not preferred:
            preferred = free_beds # Fallback if Maternity is full
            
    # 2. Priority Routing: Emergency
    elif priority == "Emergency":
        preferred = [b for b in free_beds if b["ward"] == "ICU"]
        if not preferred:
            preferred = free_beds # Fallback to any bed
            
    # 3. Standard Routing: General
    else:
        preferred = [b for b in free_beds if b["ward"] == "General"]
        if not preferred:
            preferred = free_beds # Fallback to any bed

    assigned_bed = preferred[0]
    return {
        "bed_id": assigned_bed["id"],
        "bed_number": assigned_bed["bed_number"],
        "ward": assigned_bed["ward"],
        "reason": f"Assigned {assigned_bed['ward']} ward bed {assigned_bed['bed_number']} based on priority and symptoms.",
        "source": "rule_based"
    }