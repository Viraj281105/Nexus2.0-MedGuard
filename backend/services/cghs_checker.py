import re
from typing import Optional

# Mock CGHS Database (In reality, this would be a large SQL/NoSQL DB)
CGHS_RATES = {
    # PATHOLOGY / LAB
    "complete blood count": 120,
    "haemoglobin": 30,
    "blood sugar fasting": 30,
    "blood sugar post prandial": 30,
    "hba1c": 200,
    "lipid profile": 150,
    "liver function test": 150,
    "kidney function test": 150,
    "serum creatinine": 40,
    "uric acid": 50,
    "thyroid function test": 300,
    "tsh": 150,
    "urine routine examination": 30,
    "urine culture sensitivity": 150,
    "blood culture sensitivity": 300,
    "widal test": 60,
    "dengue ns1 antigen": 600,
    "dengue igm igg": 600,
    "malaria antigen test": 50,
    "covid rt pcr": 500,
    "vitamin d": 600,
    "vitamin b12": 400,
    "serum calcium": 50,
    "serum electrolytes": 100,
    "prothrombin time": 80,
    "esr": 30,
    "hiv test": 100,
    "hepatitis b surface antigen": 100,
    "hepatitis c antibody": 200,
    "psa": 400,

    # RADIOLOGY / IMAGING
    "x ray chest": 100,
    "x ray abdomen": 100,
    "x ray spine": 120,
    "x ray knee": 100,
    "ultrasound abdomen": 400,
    "ultrasound pelvis": 400,
    "ultrasound obstetric": 400,
    "echocardiography": 900,
    "ecg": 80,
    "2d echo": 900,
    "ct scan head": 1800,
    "ct scan chest": 2200,
    "ct scan abdomen": 2200,
    "mri brain": 2800,
    "mri spine": 3000,
    "mri knee": 3000,
    "doppler study": 800,

    # PROCEDURES / CONSULTATIONS
    "physiotherapy per session": 100,
    "specialist consultation": 300,
    "general consultation": 150,
}

def get_cghs_rate(procedure_name: str) -> Optional[tuple]:
    """
    Returns (matched_procedure, cghs_rate) or None if no match found.
    Uses substring and keyword matching for flexibility.
    """
    procedure_lower = procedure_name.lower().strip()
    
    best_match = None
    best_score = 0
    
    for cghs_name, rate in CGHS_RATES.items():
        # Direct substring match
        if cghs_name in procedure_lower or procedure_lower in cghs_name:
            return (cghs_name, rate)
        
        # Keyword overlap score
        cghs_words = set(cghs_name.split())
        bill_words = set(procedure_lower.split())
        overlap = len(cghs_words & bill_words)
        
        if overlap > best_score:
            best_score = overlap
            best_match = (cghs_name, rate)
    
    # Only return if at least 2 keywords matched
    if best_score >= 2:
        return best_match
    
    # Single keyword match as last resort
    if best_score == 1 and best_match:
        return best_match
        
    return None