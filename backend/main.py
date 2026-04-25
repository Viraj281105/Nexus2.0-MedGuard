from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from services.ocr_parser import parse_bill
from services.anomaly_detector import detect_anomalies
from agents.orchestrator import AgentOrchestrator

app = FastAPI(title="MedGuard AI API")

# Global dict to store processing state for the mock
session_data = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AppealResponse(BaseModel):
    message: str
    download_url: str

class ProcessBillResponse(BaseModel):
    overcharges: List[dict]
    savings_estimate: float

@app.get("/")
def read_root():
    return {"status": "MedGuard AI API is running"}

@app.post("/api/upload", response_model=ProcessBillResponse)
async def upload_bill(file: UploadFile = File(...)):
    try:
        content = await file.read()
        
        # 1. Parse bill using PyMuPDF + heuristics (or EasyOCR for images)
        parsed_items = parse_bill(content, file.filename)
        
        # 2. Detect anomalies using CGHS benchmark
        result = detect_anomalies(parsed_items)
        
        # Save to session data for the appeal generator
        session_id = str(uuid.uuid4())
        session_data["latest"] = result
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-appeal", response_model=AppealResponse)
async def generate_appeal():
    if "latest" not in session_data:
        raise HTTPException(status_code=400, detail="No bill processed yet.")
        
    orchestrator = AgentOrchestrator()
    appeal_text = await orchestrator.run_pipeline(session_data["latest"])
    
    # Save the appeal to a text file for download
    os.makedirs("output", exist_ok=True)
    filename = f"appeal_{uuid.uuid4().hex[:8]}.txt"
    filepath = os.path.join("output", filename)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(appeal_text)
    
    return {
        "message": "Appeal generated successfully",
        "download_url": f"http://localhost:8000/api/download-appeal/{filename}"
    }

@app.get("/api/download-appeal/{filename}")
async def download_appeal(filename: str):
    filepath = os.path.join("output", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="text/plain", filename=filename)
    raise HTTPException(status_code=404, detail="File not found")
