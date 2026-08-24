"""Command-line interface for the reproducible analysis pipeline."""

from __future__ import annotations

import argparse
import shutil
from datetime import date
from pathlib import Path

from .analysis import export_analysis
from .download import download_all
from .plot import make_all_figures


def _parser() -> argparse.ArgumentParser:
    """Construct the command-line argument parser.

    Returns
    -------
    argparse.ArgumentParser
        Configured parser.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("download", "analyse", "plot", "all"))
    parser.add_argument("--raw-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--processed-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--figures-dir", type=Path, default=Path("figures"))
    parser.add_argument("--as-of", type=date.fromisoformat)
    return parser


def main() -> None:
    """Run the requested pipeline stage."""
    args = _parser().parse_args()
    if args.command in {"download", "all"}:
        download_all(args.raw_dir)
    if args.command in {"analyse", "all"}:
        export_analysis(args.raw_dir, args.processed_dir, as_of=args.as_of)
    if args.command in {"plot", "all"}:
        make_all_figures(args.processed_dir, args.figures_dir)
        website_data = Path("website/public/data")
        website_data.mkdir(parents=True, exist_ok=True)
        shutil.copy2(args.processed_dir / "analysis.json", website_data / "analysis.json")


if __name__ == "__main__":
    main()
