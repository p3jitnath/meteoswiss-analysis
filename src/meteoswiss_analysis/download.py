"""Download homogeneous climate-station records from MeteoSwiss."""

from __future__ import annotations

import json
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

from .config import DATA_ROOT, STAC_COLLECTION, STATIONS


def _download(url: str, destination: Path) -> None:
    """Download one URL atomically.

    Parameters
    ----------
    url
        Source URL.
    destination
        Local output path.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with urllib.request.urlopen(url, timeout=60) as response:  # noqa: S310
        temporary.write_bytes(response.read())
    temporary.replace(destination)


def download_all(output_dir: Path) -> dict[str, object]:
    """Download monthly and daily records for all four reference stations.

    Parameters
    ----------
    output_dir
        Directory in which source CSV files and provenance are stored.

    Returns
    -------
    dict
        Machine-readable provenance manifest.
    """
    assets: list[dict[str, str]] = []
    for station in STATIONS:
        for suffix in ("m", "d_historical", "d_recent"):
            name = f"ogd-nbcn_{station}_{suffix}.csv"
            url = f"{DATA_ROOT}/{station}/{name}"
            _download(url, output_dir / name)
            assets.append({"station": station, "file": name, "url": url})

    metadata_name = "ogd-nbcn_meta_stations.csv"
    metadata_url = f"{DATA_ROOT}/{metadata_name}"
    _download(metadata_url, output_dir / metadata_name)
    assets.append({"station": "metadata", "file": metadata_name, "url": metadata_url})

    manifest: dict[str, object] = {
        "retrieved_at": datetime.now(UTC).isoformat(),
        "collection": STAC_COLLECTION,
        "licence_note": "Source: MeteoSwiss",
        "assets": assets,
    }
    (output_dir / "provenance.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return manifest
