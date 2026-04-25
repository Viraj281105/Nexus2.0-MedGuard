from .cghs_checker import get_cghs_rate

def detect_anomalies(parsed_items: list) -> dict:
    """
    Simulates Anomaly Detection (Isolation Forest) to find overcharges.
    Calculates a confidence score based on the % deviation from CGHS rates.
    """
    overcharges = []
    total_savings = 0.0
    
    for item in parsed_items:
        name = item.get("item", "")
        charged = item.get("charged", 0.0)
        
        cghs_rate = get_cghs_rate(name)
        
        if cghs_rate > 0 and charged > cghs_rate:
            overcharge_amount = charged - cghs_rate
            
            # Simulate a confidence score based on deviation magnitude
            # E.g. > 100% markup = 95% confidence, > 50% = 85% confidence, else 70%
            deviation = (overcharge_amount / cghs_rate) * 100
            if deviation > 100:
                confidence = 0.95
            elif deviation > 50:
                confidence = 0.85
            else:
                confidence = 0.70
                
            overcharges.append({
                "item": name,
                "charged": charged,
                "cghs_rate": cghs_rate,
                "overcharge": overcharge_amount,
                "confidence": confidence
            })
            total_savings += overcharge_amount

    return {
        "overcharges": overcharges,
        "savings_estimate": total_savings
    }
