"""
Smart CSV processor: column-type detection, semantic row descriptions, aggregated summaries.
Transforms raw tabular data into embedding-friendly natural-language chunks.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd


# ── Types ──────────────────────────────────────────────────────────────

@dataclass
class ColumnProfile:
    name: str
    dtype: str  # "id" | "category" | "numeric" | "date" | "text" | "bool" | "unknown"
    unique_ratio: float  # unique / total
    null_ratio: float
    sample_values: list[str]
    min: float | None = None
    max: float | None = None
    mean: float | None = None
    top_values: list[tuple[str, int]] = field(default_factory=list)  # (value, count)


@dataclass
class SemanticChunk:
    """One chunk ready for embedding, with structured metadata."""
    source_key: str
    source_name: str
    title: str
    content: str
    metadata: dict[str, Any]
    chunk_type: str  # "row" | "summary" | "column_context"


@dataclass
class ProcessedDataset:
    name: str
    row_count: int
    columns: list[ColumnProfile]
    chunks: list[SemanticChunk]


# ── Column profiling ────────────────────────────────────────────────────

_ID_KEYWORDS = {"id", "uuid", "key", "code", "number", "account", "card_id", "customer_id", "transaction_id", "user_id", "policy_id"}
_DATE_KEYWORDS = {"date", "time", "timestamp", "issued", "expiry", "created", "updated", "year", "month"}
_CATEGORY_KEYWORDS = {"type", "status", "network", "mode", "category", "class", "tier", "group", "segment", "region", "country", "city", "state", "gender", "product", "channel", "location", "city", "state", "region", "country"}
_TEXT_KEYWORDS = {"description", "comment", "note", "text", "content", "message", "address", "name", "title", "reason"}
_BOOL_VALUES = {"yes", "no", "true", "false", "active", "inactive", "blocked", "expired", "enabled", "disabled", "1", "0"}


def _classify_column(name: str, series: pd.Series) -> str:
    """Classify column type by name heuristics + data inspection."""
    lower = name.lower().replace("_", " ").replace("-", " ")

    # Null check
    if series.dropna().empty:
        return "text"

    # Boolean detection
    unique_str = {str(v).strip().lower() for v in series.dropna().unique() if pd.notna(v)}
    if unique_str.issubset({"yes", "no"}) or unique_str.issubset({"true", "false"}):
        return "bool"

    # Numeric check
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.notna().sum() > len(series) * 0.8:
        if any(kw in lower for kw in _ID_KEYWORDS) and len(series) > 10:
            return "id"
        return "numeric"

    # Date check
    if any(kw in lower for kw in _DATE_KEYWORDS):
        return "date"

    # ID check by keyword
    if any(kw in lower for kw in _ID_KEYWORDS):
        return "id"

    # Category vs text
    unique_ratio = series.nunique() / max(len(series), 1)
    if unique_ratio < 0.1 or any(kw in lower for kw in _CATEGORY_KEYWORDS):
        return "category"
    if any(kw in lower for kw in _TEXT_KEYWORDS):
        return "text"
    if unique_ratio < 0.5:
        return "category"
    return "text"


def _format_value(value: Any, col_type: str) -> str:
    """Format a cell value for natural language."""
    if pd.isna(value) or value is None:
        return "N/A"
    s = str(value).strip()
    if col_type == "numeric":
        try:
            v = float(s)
            if v >= 1_000_000:
                return f"${v:,.0f}"
            if v >= 1_000:
                return f"${v:,.0f}"
            return f"{v:,.2f}" if v != int(v) else f"{int(v):,}"
        except ValueError:
            return s
    if col_type == "bool":
        return s.lower()
    if col_type == "date":
        return s
    return s


def _describe_column_type(col_type: str) -> str:
    mapping = {
        "id": "identifier",
        "category": "category",
        "numeric": "numeric value",
        "date": "date",
        "text": "text field",
        "bool": "flag",
    }
    return mapping.get(col_type, "field")


def profile_columns(df: pd.DataFrame) -> list[ColumnProfile]:
    """Profile all columns in a dataframe."""
    profiles: list[ColumnProfile] = []
    for col in df.columns:
        series = df[col]
        cls = _classify_column(col, series)
        numeric = pd.to_numeric(series, errors="coerce")

        vals = series.dropna().astype(str).str.strip().replace("", pd.NA).dropna().tolist()
        n_non_null = len(series.dropna())
        n_null = len(series) - n_non_null

        top_vals = series.value_counts().head(5)
        top_list = [(str(k), int(v)) for k, v in top_vals.items()]

        prof = ColumnProfile(
            name=col,
            dtype=cls,
            unique_ratio=series.nunique() / max(len(series), 1),
            null_ratio=n_null / max(len(series), 1),
            sample_values=vals[:3],
            min=float(numeric.min()) if numeric.notna().any() and cls == "numeric" else None,
            max=float(numeric.max()) if numeric.notna().any() and cls == "numeric" else None,
            mean=float(numeric.mean()) if numeric.notna().any() and cls == "numeric" else None,
            top_values=top_list,
        )
        profiles.append(prof)

    return profiles


# ── Row-to-text conversion ──────────────────────────────────────────────

def _format_row_as_sentence(
    row: dict[str, Any],
    profiles: list[ColumnProfile],
    name_col: str | None = None,
) -> str:
    """Convert one data row into a readable natural-language sentence."""
    parts: list[str] = []
    profile_map = {p.name: p for p in profiles}

    for col in row:
        val = _format_value(row[col], profile_map.get(col, ColumnProfile(name=col, dtype="text", unique_ratio=0, null_ratio=0, sample_values=[])).dtype)

        if val == "N/A":
            continue

        col_type = profile_map.get(col, ColumnProfile(name=col, dtype="text", unique_ratio=0, null_ratio=0, sample_values=[])).dtype
        display_name = col.replace("_", " ").title()

        if col_type == "id":
            parts.append(f"{display_name}={val}")
        elif col_type == "bool":
            parts.append(f"{display_name}={val}")
        elif col_type == "numeric":
            parts.append(f"{display_name}={val}")
        elif col_type == "category":
            parts.append(f"{display_name}={val}")
        elif col_type == "date":
            parts.append(f"{display_name}={val}")
        else:
            parts.append(f"{display_name}={val}")

    if not parts:
        return "Empty record."

    return " | ".join(parts)


def _generate_summary_chunks(
    df: pd.DataFrame,
    profiles: list[ColumnProfile],
    source_name: str,
) -> list[SemanticChunk]:
    """Generate aggregated summary chunks about the dataset."""
    chunks: list[SemanticChunk] = []
    n = len(df)

    # Dataset overview
    overview = (
        f"Dataset '{source_name}' contains {n} records with "
        f"{len(profiles)} columns: {', '.join(p.name for p in profiles)}. "
        f"Column types: "
    )
    type_counts: dict[str, int] = {}
    for p in profiles:
        type_counts[p.dtype] = type_counts.get(p.dtype, 0) + 1
    type_desc = "; ".join(f"{count} {dtype}" for dtype, count in type_counts.items())
    overview += type_desc + "."

    chunks.append(SemanticChunk(
        source_key=f"{source_name}:summary:overview",
        source_name=source_name,
        title=f"{source_name} — Dataset Overview",
        content=overview,
        metadata={"chunk_type": "summary", "kind": "overview"},
        chunk_type="summary",
    ))

    # Per-column summaries
    for prof in profiles:
        if prof.dtype == "id":
            continue

        lines: list[str] = []
        col_display = prof.name.replace("_", " ").title()
        lines.append(f"Column '{col_display}' ({_describe_column_type(prof.dtype)}):")

        if prof.dtype == "numeric" and prof.min is not None:
            lines.append(f"  Range: {prof.min:,.2f} to {prof.max:,.2f}, Average: {prof.mean:,.2f}")
        elif prof.dtype == "category":
            top_str = "; ".join(f"{v} ({c}x)" for v, c in prof.top_values[:5])
            lines.append(f"  Top values: {top_str}")
        elif prof.dtype == "date":
            non_null = df[prof.name].dropna()
            if not non_null.empty:
                lines.append(f"  Range: {non_null.min()} to {non_null.max()}")
        elif prof.dtype == "text":
            lines.append(f"  {prof.sample_values[0][:80] + '...' if prof.sample_values else 'N/A'}")

        content = "\n".join(lines)
        chunks.append(SemanticChunk(
            source_key=f"{source_name}:summary:col:{prof.name}",
            source_name=source_name,
            title=f"{source_name} — Column: {col_display}",
            content=content,
            metadata={"chunk_type": "summary", "kind": "column", "column": prof.name},
            chunk_type="summary",
        ))

    return chunks


# ── Main entry point ────────────────────────────────────────────────────

def process_csv(
    csv_path: str,
    source_name: str | None = None,
    max_rows: int | None = 5000,
    generate_summaries: bool = True,
) -> ProcessedDataset:
    """Process a CSV file into semantic chunks.

    Args:
        csv_path: Path to CSV file.
        source_name: Dataset name (default: filename).
        max_rows: Max rows to process.
        generate_summaries: Whether to generate aggregated summary chunks.

    Returns:
        ProcessedDataset with profiled columns and semantic chunks.
    """
    # Parse
    df = pd.read_csv(csv_path, on_bad_lines="skip", low_memory=False)
    df = df.dropna(how="all", axis=1).dropna(how="all", axis=0)

    if max_rows and len(df) > max_rows:
        df = df.sample(n=max_rows, random_state=42)

    # Strip whitespace from string columns
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].astype(str).str.strip()

    profiles = profile_columns(df)
    name = source_name or csv_path.split("/")[-1].replace(".csv", "").replace("_", " ").title()

    # Build chunks
    chunks: list[SemanticChunk] = []

    # Row chunks
    for idx, (_, row) in enumerate(df.iterrows()):
        row_dict = row.to_dict()
        content = _format_row_as_sentence(row_dict, profiles)

        # Find a good title field
        title_col = None
        for p in profiles:
            if p.dtype == "id":
                title_col = p.name
                break
            if "title" in p.name.lower() or "name" in p.name.lower():
                title_col = p.name
                break

        title_val = _format_value(row_dict.get(title_col or ""), "text") if title_col else f"Record {idx + 1}"

        row_metadata: dict[str, Any] = {
            "row_index": idx,
            "original_row": {k: str(v) for k, v in row_dict.items()},
        }

        chunks.append(SemanticChunk(
            source_key=f"{name}:row:{idx}",
            source_name=name,
            title=f"{name} — {title_val}",
            content=content,
            metadata=row_metadata,
            chunk_type="row",
        ))

    # Summary chunks
    if generate_summaries:
        summary_chunks = _generate_summary_chunks(df, profiles, name)
        chunks.extend(summary_chunks)

    return ProcessedDataset(
        name=name,
        row_count=len(df),
        columns=profiles,
        chunks=chunks,
    )


def chunk_to_dict(chunk: SemanticChunk) -> dict[str, Any]:
    """Serialize a SemanticChunk to dict for JSON transport."""
    return {
        "source_key": chunk.source_key,
        "source_name": chunk.source_name,
        "title": chunk.title,
        "content": chunk.content,
        "metadata": chunk.metadata,
        "chunk_type": chunk.chunk_type,
    }