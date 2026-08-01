"""Extract text from XLSX/XLS files via pandas."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def extract_xlsx(file_path: str | Path) -> dict[str, Any]:
    """Extract text from .xlsx or .xls file.

    Reads each sheet as CSV-like rows, concatenates into text.
    Returns dict with: text (str), title (str), metadata (dict)
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"XLSX not found: {path}")

    ext = path.suffix.lower()
    if ext not in (".xlsx", ".xls"):
        raise ValueError(f"Not an Excel file: {path}")

    # Read all sheets
    xls = pd.read_excel(path, sheet_name=None, engine="openpyxl" if ext == ".xlsx" else "xlrd")

    parts: list[str] = []
    sheet_info: dict[str, int] = {}
    for sheet_name, df in xls.items():
        rows = len(df)
        cols = len(df.columns)
        sheet_info[sheet_name] = rows
        if df.empty:
            continue

        # Drop fully empty columns/rows
        df = df.dropna(how="all", axis=1).dropna(how="all", axis=0)
        if df.empty:
            continue

        # Header line
        headers = " | ".join(str(c) for c in df.columns)
        parts.append(f"Sheet: {sheet_name} ({rows} rows, {cols} cols)")
        parts.append(f"Columns: {headers}")

        # Format rows as pipe-delimited text (first 100 rows to limit size)
        max_sample = min(rows, 100)
        for idx in range(max_sample):
            row_vals = [str(v) for v in df.iloc[idx].values]
            parts.append(" | ".join(row_vals))

        if rows > max_sample:
            parts.append(f"... ({rows - max_sample} more rows)")

    text = "\n".join(parts)
    title = path.stem

    return {
        "text": text,
        "title": title,
        "metadata": {
            "filename": path.name,
            "file_type": ext,
            "sheets": sheet_info,
        },
    }