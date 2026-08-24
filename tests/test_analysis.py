"""Tests for seasonal aggregation and partial-season handling."""

from datetime import date

import numpy as np
import pandas as pd

from meteoswiss_analysis.analysis import compute_complete_seasons, compute_partial_season
from meteoswiss_analysis.config import SEASONS


def test_complete_jja_is_day_weighted() -> None:
    """Seasonal means weight monthly values by their calendar-day counts."""
    index = pd.to_datetime(["2000-06-01", "2000-07-01", "2000-08-01"])
    frame = pd.DataFrame({station: [0.0, 31.0, 0.0] for station in "abcd"}, index=index)
    result = compute_complete_seasons(frame, SEASONS["jja"])
    assert np.isclose(result.loc[2000], 31.0 * 31.0 / 92.0)


def test_incomplete_year_is_excluded() -> None:
    """Monthly aggregation excludes seasons without every requested month."""
    index = pd.to_datetime(["2001-06-01", "2001-07-01"])
    frame = pd.DataFrame({station: [1.0, 2.0] for station in "abcd"}, index=index)
    assert compute_complete_seasons(frame, SEASONS["jja"]).empty


def test_partial_season_reports_coverage() -> None:
    """Partial aggregation reports observed and expected day counts."""
    index = pd.date_range(date(2026, 6, 1), date(2026, 8, 23), freq="D")
    frame = pd.DataFrame({station: 2.0 for station in "abcd"}, index=index)
    result = compute_partial_season(frame, SEASONS["jja"], 2026)
    assert result == (2.0, 84, 92)
