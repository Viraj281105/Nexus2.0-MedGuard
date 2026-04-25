import requests
import json
import time

BASE_URL = "http://localhost:8000/api"
TEST_PDF_PATH = "d:/Hackathons/Nexus2.0/docs/Nueral Nomads Submission PPT.pdf"

print("--- MedGuard AI End-to-End Test ---")

# Step 1: Upload Bill
print("\n1. Uploading Hospital Bill to ClaimShield Layer...")
with open(TEST_PDF_PATH, "rb") as f:
    files = {"file": ("test_bill.pdf", f, "application/pdf")}
    response = requests.post(f"{BASE_URL}/upload", files=files)

if response.status_code == 200:
    data = response.json()
    print("SUCCESS: Bill parsed and anomalies detected.")
    print("Overcharges Found:")
    for item in data.get("overcharges", []):
        print(f"  - {item['item']}: Charged ₹{item['charged']}, CGHS Rate: ₹{item['cghs_rate']} (Confidence: {item['confidence']})")
    print(f"Total Estimated Savings: ₹{data.get('savings_estimate')}")
else:
    print(f"FAILED: {response.text}")
    exit(1)

# Step 2: Generate Appeal
print("\n2. Triggering AdvocAI Multi-Agent Pipeline...")
time.sleep(1)
response = requests.post(f"{BASE_URL}/generate-appeal")

if response.status_code == 200:
    appeal_data = response.json()
    print(f"SUCCESS: {appeal_data['message']}")
    download_url = appeal_data['download_url']
    print(f"Download URL: {download_url}")
else:
    print(f"FAILED: {response.text}")
    exit(1)

# Step 3: Download Appeal
print("\n3. Downloading Generated Appeal...")
time.sleep(1)
response = requests.get(download_url)
if response.status_code == 200:
    print("SUCCESS: Appeal document retrieved. Preview:")
    print("-" * 50)
    print(response.text[:500] + "...\n[TRUNCATED]")
    print("-" * 50)
else:
    print(f"FAILED: {response.text}")
    exit(1)

print("\n--- Test Completed Successfully! ---")
