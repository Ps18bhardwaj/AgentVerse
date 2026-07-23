"""FastAPI endpoints for OCR & Vision processing."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from .vision_engine import analyze_image_or_scanned_doc

router = APIRouter(prefix="/ocr", tags=["OCR & Vision"])


@router.post("/process")
async def process_ocr_document(file: UploadFile = File(...)) -> dict:
    """Extract text, tables, and structured data from scanned PDFs, images, diagrams, or screenshots."""
    if not file:
        raise HTTPException(400, "No file provided.")
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(400, "Empty file.")

    return analyze_image_or_scanned_doc(raw_bytes, file.filename or "image.png")
