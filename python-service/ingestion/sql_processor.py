"""Parse SQL files into readable text chunks."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any


def extract_sql(file_path: str | Path) -> dict[str, Any]:
    """Parse a .sql file into structured text.

    Breaks into logical sections: CREATE TABLE, INSERT, SELECT, etc.
    Returns dict with: text (str), title (str), metadata (dict)
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")

    raw = path.read_text(encoding="utf-8", errors="replace")

    title = path.stem
    statements = _split_statements(raw)

    # Build readable description
    parts: list[str] = []
    stmt_types: dict[str, int] = {}

    for stmt in statements:
        stype = _classify_stmt(stmt)
        stmt_types[stype] = stmt_types.get(stype, 0) + 1
        parts.append(f"-- Statement type: {stype}")
        parts.append(stmt.strip()[:2000])  # cap per-statement length
        parts.append("")

    text = "\n".join(parts).strip()
    if not text:
        text = f"-- SQL file: {title}\n-- No parseable statements found.\n{raw[:5000]}"

    return {
        "text": text,
        "title": title,
        "metadata": {
            "filename": path.name,
            "file_type": "sql",
            "statement_count": len(statements),
            "statement_types": stmt_types,
        },
    }


def _split_statements(sql: str) -> list[str]:
    """Split SQL into individual statements, handling semicolons inside strings."""
    sql = _strip_sql_comments(sql).strip()
    if not sql:
        return []

    statements: list[str] = []
    current = ""
    in_string = False
    string_char = ""
    i = 0

    while i < len(sql):
        c = sql[i]
        if in_string:
            current += c
            if c == string_char and (i == 0 or sql[i - 1] != "\\"):
                in_string = False
        elif c in ("'", '"'):
            in_string = True
            string_char = c
            current += c
        elif c == ";":
            stmt = current.strip()
            if stmt:
                statements.append(stmt + ";")
            current = ""
        else:
            current += c
        i += 1

    remaining = current.strip()
    if remaining:
        statements.append(remaining)

    return statements


def _strip_sql_comments(sql: str) -> str:
    """Remove SQL comments (-- and /* */)."""
    # Block comments
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    # Line comments
    sql = re.sub(r"--[^\n]*", "", sql)
    return sql


def _classify_stmt(stmt: str) -> str:
    """Classify SQL statement by its leading keyword."""
    upper = stmt.strip().upper()
    for kw in [
        "CREATE TABLE",
        "CREATE INDEX",
        "CREATE VIEW",
        "CREATE PROCEDURE",
        "CREATE FUNCTION",
        "CREATE TRIGGER",
        "ALTER TABLE",
        "DROP TABLE",
        "DROP INDEX",
        "DROP VIEW",
        "INSERT INTO",
        "SELECT",
        "UPDATE",
        "DELETE FROM",
        "TRUNCATE",
        "MERGE INTO",
        "WITH",
        "GRANT",
        "REVOKE",
    ]:
        if upper.startswith(kw):
            return kw
    # Fallback: first word
    first = upper.split()[0] if upper.split() else "UNKNOWN"
    return first


def extract_sql_metadata(file_path: str | Path) -> dict[str, Any]:
    """Extract table names, column info from SQL schema."""
    path = Path(file_path)
    raw = path.read_text(encoding="utf-8", errors="replace")
    clean = _strip_sql_comments(raw)

    tables: list[dict[str, Any]] = []
    create_pattern = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`?(\w+)`?\.)?`?(\w+)`?\s*\((.*?)\)",
        re.IGNORECASE | re.DOTALL,
    )

    for match in create_pattern.finditer(clean):
        schema = match.group(1) or ""
        table = match.group(2)
        col_text = match.group(3)
        columns = _extract_columns(col_text)
        tables.append({
            "schema": schema,
            "table": table,
            "columns": columns,
            "column_count": len(columns),
        })

    return {"tables": tables, "table_count": len(tables)}


_COLUMN_RE = re.compile(
    r"`?(\w+)`?\s+([A-Za-z0-9_()]+)", re.IGNORECASE
)


def _extract_columns(col_text: str) -> list[dict[str, str]]:
    """Extract column name + type from CREATE TABLE column definitions."""
    # Remove constraint clauses inside parens to avoid false matches
    col_text = re.sub(r"\(\d+\)", lambda m: f"__NUM__{m.group(0)}", col_text)
    cols: list[dict[str, str]] = []
    for line in col_text.split(","):
        line = line.strip()
        if not line:
            continue
        m = _COLUMN_RE.match(line)
        if m:
            cols.append({
                "name": m.group(1),
                "type": m.group(2).replace("__NUM__(", "("),
            })
    return cols