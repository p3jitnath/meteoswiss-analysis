"""Compute seasonal temperature anomalies and distribution summaries."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from .config import (
    BASELINE_END,
    BASELINE_START,
    DAILY_TEMPERATURE,
    MONTHLY_TEMPERATURE,
    RECENT_START,
    SEASONS,
    STATION_NAMES,
    STATIONS,
    SeasonDefinition,
)


@dataclass(frozen=True)
class SeasonRecord:
    """Store a seasonal mean and its baseline-relative anomaly.

    Parameters
    ----------
    year
        Calendar year.
    temperature_c
        Four-station mean 2m air temperature in degrees Celsius.
    anomaly_c
        Difference from the 1961–1990 seasonal mean in degrees Celsius.
    period
        ``historical`` for years through 1990 or ``recent`` thereafter.
    complete
        Whether every day or month in the defined season is present.
    days_observed
        Number of calendar days represented.
    days_expected
        Number of calendar days in a complete season.
    rank
        Descending warm-rank among comparable records.
    """

    year: int
    temperature_c: float
    anomaly_c: float
    period: str
    complete: bool
    days_observed: int
    days_expected: int
    rank: int | None = None


def read_meteoswiss_csv(path: Path, value_column: str) -> pd.Series:
    """Read one MeteoSwiss CSV as a timestamp-indexed numeric series.

    Parameters
    ----------
    path
        Semicolon-delimited MeteoSwiss source file.
    value_column
        Parameter identifier to select.

    Returns
    -------
    pandas.Series
        Numeric observations indexed by timestamp.
    """
    frame = pd.read_csv(path, sep=";", usecols=["reference_timestamp", value_column])
    frame["reference_timestamp"] = pd.to_datetime(
        frame["reference_timestamp"], format="%d.%m.%Y %H:%M"
    )
    return frame.set_index("reference_timestamp")[value_column].dropna().astype(float)


def load_station_series(raw_dir: Path, frequency: str) -> pd.DataFrame:
    """Load and align records from the four reference stations.

    Parameters
    ----------
    raw_dir
        Directory containing downloaded MeteoSwiss CSV files.
    frequency
        Either ``monthly`` or ``daily``.

    Returns
    -------
    pandas.DataFrame
        Time-aligned station values with lowercase station identifiers.

    Raises
    ------
    ValueError
        If the frequency is unsupported.
    """
    if frequency == "monthly":
        pieces = {
            station: read_meteoswiss_csv(raw_dir / f"ogd-nbcn_{station}_m.csv", MONTHLY_TEMPERATURE)
            for station in STATIONS
        }
    elif frequency == "daily":
        pieces = {}
        for station in STATIONS:
            historical = read_meteoswiss_csv(
                raw_dir / f"ogd-nbcn_{station}_d_historical.csv", DAILY_TEMPERATURE
            )
            recent = read_meteoswiss_csv(
                raw_dir / f"ogd-nbcn_{station}_d_recent.csv", DAILY_TEMPERATURE
            )
            pieces[station] = pd.concat([historical, recent]).sort_index()
            pieces[station] = pieces[station][~pieces[station].index.duplicated(keep="last")]
    else:
        raise ValueError(f"Unsupported frequency: {frequency}")
    return pd.DataFrame(pieces).dropna(how="any")


def _expected_days(year: int, season: SeasonDefinition) -> int:
    """Return the number of days in a season.

    Parameters
    ----------
    year
        Calendar year.
    season
        Season definition.

    Returns
    -------
    int
        Number of calendar days.
    """
    dates = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="D")
    return int(dates.month.isin(season.months).sum())


def compute_complete_seasons(monthly: pd.DataFrame, season: SeasonDefinition) -> pd.Series:
    """Calculate equal-station, day-weighted seasonal mean temperatures.

    Parameters
    ----------
    monthly
        Homogeneous monthly mean temperatures by station.
    season
        Months included in each seasonal value.

    Returns
    -------
    pandas.Series
        Seasonal mean temperature indexed by calendar year.

    Notes
    -----
    The four stations are averaged with equal weights, following Schär et al.
    (2004). Monthly means are weighted by days per month so the result equals a
    mean over the complete season rather than a mean of unequal-length months.
    """
    selected = monthly[monthly.index.month.isin(season.months)].copy()
    station_mean = selected.mean(axis=1)
    weighted = station_mean * selected.index.days_in_month
    totals = weighted.groupby(selected.index.year).sum()
    weights = (
        pd.Series(selected.index.days_in_month, index=selected.index)
        .groupby(selected.index.year)
        .sum()
    )
    counts = station_mean.groupby(selected.index.year).count()
    complete = counts == len(season.months)
    return (totals / weights)[complete]


def compute_partial_season(
    daily: pd.DataFrame, season: SeasonDefinition, year: int
) -> tuple[float, int, int] | None:
    """Calculate a season-to-date mean from homogeneous daily values.

    Parameters
    ----------
    daily
        Daily temperature by station.
    season
        Season definition.
    year
        Target calendar year.

    Returns
    -------
    tuple or None
        Temperature, observed days, and expected days, or ``None`` when absent.
    """
    mask = (daily.index.year == year) & daily.index.month.isin(season.months)
    values = daily.loc[mask].mean(axis=1)
    if values.empty:
        return None
    return float(values.mean()), int(values.size), _expected_days(year, season)


def _partial_baseline(daily: pd.DataFrame, season: SeasonDefinition, observed_days: int) -> float:
    """Calculate a calendar-matched 1961–1990 baseline for partial seasons.

    Parameters
    ----------
    daily
        Daily temperature by station.
    season
        Season definition.
    observed_days
        Number of consecutive season days available in the current year.

    Returns
    -------
    float
        Mean temperature over the matching calendar window in 1961–1990.
    """
    annual: list[float] = []
    for year in range(BASELINE_START, BASELINE_END + 1):
        mask = (daily.index.year == year) & daily.index.month.isin(season.months)
        values = daily.loc[mask].mean(axis=1).iloc[:observed_days]
        if len(values) == observed_days:
            annual.append(float(values.mean()))
    if len(annual) != BASELINE_END - BASELINE_START + 1:
        raise ValueError("The daily baseline does not cover every reference year")
    return float(np.mean(annual))


def build_records(
    monthly: pd.DataFrame,
    daily: pd.DataFrame,
    season: SeasonDefinition,
    as_of: date | None = None,
) -> tuple[list[SeasonRecord], dict[str, float | int | str]]:
    """Build complete and provisional seasonal records plus summary statistics.

    Parameters
    ----------
    monthly
        Homogeneous monthly station series.
    daily
        Homogeneous daily station series.
    season
        Season to aggregate.
    as_of
        Date used to identify the current year; defaults to today.

    Returns
    -------
    records
        Complete seasons and, when available, the current partial season.
    summary
        Baseline, period means, shifts, variability, and warmest years.
    """
    as_of = as_of or date.today()
    complete = compute_complete_seasons(monthly, season)
    baseline = float(complete.loc[BASELINE_START:BASELINE_END].mean())
    records: list[SeasonRecord] = []
    for year, temperature in complete.items():
        expected = _expected_days(int(year), season)
        records.append(
            SeasonRecord(
                year=int(year),
                temperature_c=float(temperature),
                anomaly_c=float(temperature - baseline),
                period="historical" if year <= BASELINE_END else "recent",
                complete=True,
                days_observed=expected,
                days_expected=expected,
            )
        )

    current_is_in_season = as_of.month in season.months
    if as_of.year not in complete.index and current_is_in_season:
        partial = compute_partial_season(daily.loc[: pd.Timestamp(as_of)], season, as_of.year)
        if partial is not None:
            temperature, observed, expected = partial
            partial_baseline = _partial_baseline(daily, season, observed)
            records.append(
                SeasonRecord(
                    year=as_of.year,
                    temperature_c=temperature,
                    anomaly_c=temperature - partial_baseline,
                    period="provisional",
                    complete=False,
                    days_observed=observed,
                    days_expected=expected,
                )
            )

    complete_records = [record for record in records if record.complete]
    ranks = {
        record.year: rank
        for rank, record in enumerate(
            sorted(complete_records, key=lambda item: item.anomaly_c, reverse=True), start=1
        )
    }
    records = [
        SeasonRecord(**{**asdict(record), "rank": ranks.get(record.year)}) for record in records
    ]
    historical = np.array([r.anomaly_c for r in records if r.complete and r.year <= BASELINE_END])
    recent = np.array([r.anomaly_c for r in records if r.complete and r.year >= RECENT_START])
    warmest = max(complete_records, key=lambda item: item.anomaly_c)
    summary: dict[str, float | int | str] = {
        "season": season.key,
        "season_label": season.label,
        "baseline_start": BASELINE_START,
        "baseline_end": BASELINE_END,
        "baseline_temperature_c": round(baseline, 3),
        "historical_period_start": int(min(r.year for r in complete_records)),
        "historical_mean_anomaly_c": round(float(historical.mean()), 3),
        "historical_std_c": round(float(historical.std(ddof=1)), 3),
        "recent_period_start": RECENT_START,
        "recent_period_end": int(max(r.year for r in complete_records)),
        "recent_mean_anomaly_c": round(float(recent.mean()), 3),
        "recent_std_c": round(float(recent.std(ddof=1)), 3),
        "mean_shift_c": round(float(recent.mean() - historical.mean()), 3),
        "warmest_year": warmest.year,
        "warmest_anomaly_c": round(warmest.anomaly_c, 3),
        "as_of": as_of.isoformat(),
    }
    return records, summary


def export_analysis(raw_dir: Path, output_dir: Path, as_of: date | None = None) -> None:
    """Export analysis results for figures and the web application.

    Parameters
    ----------
    raw_dir
        Directory containing downloaded MeteoSwiss files.
    output_dir
        Directory for CSV and JSON analysis products.
    as_of
        Optional reproducibility date.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    monthly = load_station_series(raw_dir, "monthly")
    daily = load_station_series(raw_dir, "daily")
    payload: dict[str, object] = {
        "metadata": {
            "source": "MeteoSwiss",
            "stations": [STATION_NAMES[station] for station in STATIONS],
            "method": "Equal mean of four homogeneous station series; 1961–1990 baseline",
        },
        "seasons": {},
    }
    for key, season in SEASONS.items():
        records, summary = build_records(monthly, daily, season, as_of=as_of)
        table = pd.DataFrame([asdict(record) for record in records])
        table.to_csv(output_dir / f"{key}_anomalies.csv", index=False, float_format="%.3f")
        payload["seasons"][key] = {
            "summary": summary,
            "records": [asdict(record) for record in records],
        }
    (output_dir / "analysis.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
