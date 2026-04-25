import re

# Mock CGHS Database (In reality, this would be a large SQL/NoSQL DB)
CGHS_RATES = {
    "blood count": 320.0,
    "consultation": 800.0,
    "room rent": 3000.0,
    "x-ray": 400.0,
    "ecg": 250.0,
    "mri": 4500.0,
    "ct scan": 2500.0
}

def get_cghs_rate(item_name: str) -> float:
    """
    Looks up the CGHS standard rate for a given medical item/procedure.
    Uses fuzzy matching/keywords.
    """
    item_lower = item_name.lower()
    
    for key, rate in CGHS_RATES.items():
        if key in item_lower:
            return rate
            
    # Default fallback rate if not found
    return 0.0
