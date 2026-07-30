"""Embed text chunks via NVIDIA NIM API."""

from __future__ import annotations

import httpx

NIM_BASE = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL = "nvidia/nv-embedqa-e5-v5"
DEFAULT_DIM = 1024


async def embed_batch(
    texts: list[str],
    api_key: str,
    model: str = DEFAULT_MODEL,
) -> list[list[float]]:
    """Embed a batch of texts. Returns N x D list."""
    if not texts:
        return []

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{NIM_BASE}/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "input": [t.replace("\x00", "") for t in texts],
                "model": model,
                "input_type": "passage",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in data["data"]]


async def embed_query(query: str, api_key: str, model: str = DEFAULT_MODEL) -> list[float]:
    """Embed a single query string."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{NIM_BASE}/embeddings",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "input": [query.replace("\x00", "")],
                "model": model,
                "input_type": "query",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["data"][0]["embedding"]