import whisper
import os
import tempfile
import logging

logger = logging.getLogger(__name__)

# Load model globally to avoid loading it per request
try:
    # Use "tiny" or "base" to prevent high memory usage during the hackathon demo
    WHISPER_MODEL = whisper.load_model("base")
    logger.info("Whisper model loaded successfully.")
except Exception as e:
    logger.warning(f"Failed to load Whisper model: {e}")
    WHISPER_MODEL = None

# Hinglish mapping for medical/billing context normalization
HINGLISH_MAP = {
    "dawai": "medicine",
    "doctor sahab": "doctor",
    "parcha": "prescription",
    "bill zyada": "overcharged bill",
    "bada bill": "high bill",
    "theek": "correct",
    "galat": "wrong",
    "paise": "money",
    "aspataal": "hospital",
    "janch": "test",
    "kharcha": "expense",
    "kamre ka kiraya": "room rent"
}

def normalize_hinglish(text: str) -> str:
    """Replaces common Hinglish medical terms with their English equivalents."""
    normalized = text.lower()
    for hin, eng in HINGLISH_MAP.items():
        normalized = normalized.replace(hin, eng)
    # Could potentially use an LLM call here for complex Hinglish context
    return normalized

def parse_audio(file_bytes: bytes, filename: str) -> str:
    """
    Parses an audio file containing voice input (Hinglish/English)
    and returns the normalized transcribed text.
    """
    if not WHISPER_MODEL:
        return "Audio parsing failed: Whisper model not loaded. (Please check logs)"

    try:
        # Whisper requires a file path, not bytes. Write to temp file.
        # Ensure we keep the original extension for ffmpeg compatibility
        ext = os.path.splitext(filename)[1] or ".mp3"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(file_bytes)
            tmp_path = tmp_file.name
        
        # Transcribe audio
        result = WHISPER_MODEL.transcribe(tmp_path)
        raw_text = result["text"]
        
        # Normalize text
        normalized_text = normalize_hinglish(raw_text)
        
        # Cleanup
        os.remove(tmp_path)
        
        return normalized_text
        
    except Exception as e:
        logger.error(f"Whisper transcription error: {e}")
        return f"Transcription error: {str(e)}"
