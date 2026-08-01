"""Extract text from DOCX files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

try:
    from docx import Document as DocxDocument

    HAVE_DOCX = True
except ImportError:
    HAVE_DOCX = False


def extract_docx(file_path: str | Path) -> dict[str, Any]:
    """Extract text + metadata from a .docx file.

    Returns:
        dict with keys: text (str), title (str), metadata (dict)
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"DOCX not found: {path}")

    if not HAVE_DOCX:
        raise RuntimeError(
            "python-docx not installed. Run: pip install python-docx"
        )

    doc = DocxDocument(str(path))

    paragraphs = [p.text for p in doc.paragraphs]
    text = "\n".join(p.strip() for p in paragraphs if p.strip())
    title = path.stem

    # Build minimal metadata
    meta: dict[str, Any] = {
        "filename": path.name,
        "file_type": "docx",
        "paragraph_count": len(paragraphs),
    }

    # Try core properties
    core = doc.core_properties
    if core.title:
        title = core.title
    if core.author:
        meta["author"] = core.author
    if core.created:
        meta["created"] = str(core.created)

    return {"text": text, "title": title, "metadata": meta}