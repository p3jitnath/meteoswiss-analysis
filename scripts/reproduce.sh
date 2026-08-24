#!/usr/bin/env bash
set -euo pipefail

uv sync --extra dev
uv run meteoswiss-analysis all
uv run pytest
uv run ruff check src tests
