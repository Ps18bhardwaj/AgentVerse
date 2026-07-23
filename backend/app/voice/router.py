"""FastAPI endpoints for Voice interaction."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from .speech_service import generate_speech_audio, process_audio_input

router = APIRouter(prefix="/voice", tags=["Voice"])


@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)) -> dict:
    """Convert spoken voice audio into text query."""
    raw = await file.read()
    return process_audio_input(raw)


@router.post("/tts")
def text_to_speech(text: str) -> dict:
    """Generate spoken voice audio from AI answer text."""
    if not text:
        raise HTTPException(400, "Text is required.")
    return generate_speech_audio(text)
