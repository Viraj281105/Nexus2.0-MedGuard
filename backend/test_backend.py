import asyncio
import os
from pathlib import Path

# Add paths if needed
import sys
sys.path.append(os.path.dirname(__file__))

from services.ocr_parser import parse_bill
from services.anomaly_detector import detect_anomalies
from agents.orchestrator import AgentOrchestrator
from services.pdf_generator import create_appeal_pdf
from db.vector_store import VectorStore
from services.speech_parser import parse_audio

async def test_pipeline_async():
    print("=== Testing End-to-End Backend Pipeline (Async) ===")
    
    # 0. Test Speech Parser (Whisper)
    print("\n--- 0. Testing Speech Parser ---")
    # Whisper might fail to load if ffmpeg is missing, but we can check the logic
    dummy_audio = b"dummy audio content"
    speech_res = parse_audio(dummy_audio, "test.mp3")
    print(f"Speech Translation Result: {speech_res}")
    
    # 1. Test OCR / LayoutLMv3 Fallback
    print("\n--- 1. Testing Document Parsing ---")
    dummy_bytes = b"dummy pdf content"
    parsed_items = parse_bill(dummy_bytes, "dummy.pdf")
    print(f"Parsed Items: {parsed_items}")
    
    # 2. Test Anomaly Detection
    print("\n--- 2. Testing Anomaly Detection ---")
    audit_result = detect_anomalies(parsed_items)
    print(f"Overcharges detected: {audit_result.get('overcharges', [])}")
    print(f"Savings estimate: {audit_result.get('savings_estimate', 0)}")
    
    # 3. Test Vector Store (FAISS)
    print("\n--- 3. Testing FAISS Vector Store ---")
    v_store = VectorStore()
    search_res = v_store.search("room rent capping", top_k=1)
    print(f"FAISS Search Result: {search_res}")
    
    # 4. Test Orchestrator Appeal Generation
    print("\n--- 4. Testing Multi-Agent Appeal Generation ---")
    data = {
        "filename": "dummy.pdf",
        "parsed_items": parsed_items,
        "overcharges": audit_result["overcharges"],
        "savings_estimate": audit_result["savings_estimate"]
    }
    
    orchestrator = AgentOrchestrator()
    appeal_text = await orchestrator.generate_appeal(data)
    print("Appeal Text Snippet:")
    print(appeal_text[:200] + "...\n")
    
    # 5. Test PDF Generation
    print("\n--- 5. Testing PDF Generation ---")
    os.makedirs("outputs", exist_ok=True)
    pdf_path = Path("outputs") / "test_appeal.pdf"
    actual_path = create_appeal_pdf(appeal_text, str(pdf_path))
    print(f"PDF generated successfully at: {actual_path}")
    print(f"File exists: {os.path.exists(actual_path)}")

if __name__ == "__main__":
    asyncio.run(test_pipeline_async())
