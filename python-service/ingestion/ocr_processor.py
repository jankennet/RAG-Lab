"""OCR for image PDFs and images via Tesseract."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

HAVE_PDF2IMAGE = False
HAVE_PYTESSERACT = False
HAVE_PIL = False

try:
    from pdf2image import convert_from_path

    HAVE_PDF2IMAGE = True
except ImportError:
    pass

try:
    import pytesseract

    HAVE_PYTESSERACT = True
except ImportError:
    pass

try:
    from PIL import Image

    HAVE_PIL = True
except ImportError:
    pass


def extract_ocr_text(
    file_path: str | Path,
    *,
    dpi: int = 200,
    lang: str = "eng",
    psm: int | None = None,
) -> dict[str, Any]:
    """Extract text from image PDF or image file via Tesseract OCR.

    Args:
        file_path: Path to PDF or image (.png, .jpg, .jpeg, .tiff, .bmp).
        dpi: DPI for PDF→image rendering (higher = better OCR, slower).
        lang: Tesseract language string (e.g. "eng", "eng+por").
        psm: Tesseract page segmentation mode (None = auto).

    Returns:
        dict with: text (str), title (str), metadata (dict)
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if not HAVE_PYTESSERACT or not HAVE_PIL:
        raise RuntimeError(
            "pytesseract or Pillow not installed. "
            "Run: pip install pytesseract Pillow"
        )

    ext = path.suffix.lower()
    title = path.stem
    meta: dict[str, Any] = {
        "filename": path.name,
        "file_type": ext,
        "ocr_lang": lang,
        "ocr_engine": "tesseract",
    }

    pages: list[str] = []

    # Image file → OCR directly
    if ext in (".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"):
        img = Image.open(path)
        config = f"--psm {psm}" if psm is not None else ""
        text = pytesseract.image_to_string(img, lang=lang, config=config)
        pages.append(text.strip())
        meta["page_count"] = 1

    # PDF → convert to images → OCR each page
    elif ext == ".pdf":
        if not HAVE_PDF2IMAGE:
            raise RuntimeError(
                "pdf2image not installed. Run: pip install pdf2image"
            )

        # Check if PDF has text layer (skip OCR if we can extract text directly)
        has_text = _has_text_layer_pdftotext(path)
        if has_text:
            text = _simple_pdf_text(path)
            if text.strip():
                meta["ocr_needed"] = False
                return {"text": text, "title": title, "metadata": meta}

        meta["ocr_needed"] = True
        images = convert_from_path(path, dpi=dpi)
        meta["page_count"] = len(images)

        for i, img in enumerate(images):
            config = f"--psm {psm}" if psm is not None else ""
            page_text = pytesseract.image_to_string(img, lang=lang, config=config)
            if page_text.strip():
                pages.append(f"--- Page {i + 1} ---\n{page_text.strip()}")

    else:
        raise ValueError(f"Unsupported file type for OCR: {ext}")

    text = "\n\n".join(pages)
    return {"text": text, "title": title, "metadata": meta}


def _has_text_layer_pdftotext(path: Path) -> bool:
    """Use pdftotext CLI to check for text layer (from poppler-utils)."""
    import subprocess

    try:
        result = subprocess.run(
            ["pdftotext", str(path), "-", "-l", "1", "-q"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return len(result.stdout.strip()) > 50
    except Exception:
        return False


def _simple_pdf_text(path: Path) -> str:
    """Extract text from PDF via pdftotext CLI."""
    import subprocess

    try:
        result = subprocess.run(
            ["pdftotext", str(path), "-", "-q"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout.strip()
    except Exception:
        return ""