"""Create publication-ready temperature-distribution figures."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import norm

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SKILL_DIR = Path(
    os.environ.get("GRAPH_PLOTTING_SKILL_DIR", PROJECT_ROOT / "vendor" / "graph-plotting")
)
sys.path.insert(0, str(SKILL_DIR / "scripts"))
from mpl_style import audit_figure, finish_axis, publication_style, save_figure  # noqa: E402

HISTORICAL_COLOUR = "#4C78A8"
RECENT_COLOUR = "#E45756"
PROVISIONAL_COLOUR = "#7A5195"


def _density_axis(
    axis: plt.Axes, records: list[dict[str, object]], summary: dict[str, object]
) -> None:
    """Draw two empirical distributions and fitted Gaussian curves.

    Parameters
    ----------
    axis
        Target Matplotlib axis.
    records
        Seasonal anomaly records.
    summary
        Distribution summary statistics.
    """
    historical = np.array(
        [r["anomaly_c"] for r in records if r["complete"] and r["year"] <= 1990], dtype=float
    )
    recent = np.array(
        [r["anomaly_c"] for r in records if r["complete"] and r["year"] >= 1991], dtype=float
    )
    limits = (min(historical.min(), recent.min()) - 0.5, max(historical.max(), recent.max()) + 0.5)
    grid = np.linspace(*limits, 500)
    bins = np.arange(np.floor(limits[0] * 2) / 2, np.ceil(limits[1] * 2) / 2 + 0.5, 0.5)
    axis.hist(
        historical,
        bins=bins,
        density=True,
        alpha=0.18,
        color=HISTORICAL_COLOUR,
        edgecolor=HISTORICAL_COLOUR,
        linewidth=0.5,
    )
    axis.hist(
        recent,
        bins=bins,
        density=True,
        alpha=0.18,
        color=RECENT_COLOUR,
        edgecolor=RECENT_COLOUR,
        linewidth=0.5,
    )
    for values, colour, label in (
        (historical, HISTORICAL_COLOUR, f"1864–1990 (n={len(historical)})"),
        (recent, RECENT_COLOUR, f"1991–{summary['recent_period_end']} (n={len(recent)})"),
    ):
        mean = float(values.mean())
        standard_deviation = float(values.std(ddof=1))
        axis.plot(grid, norm.pdf(grid, mean, standard_deviation), color=colour, lw=1.6, label=label)
        axis.axvline(mean, color=colour, lw=0.8, ls="--")
    axis.axvline(0, color="#595959", lw=0.7, zorder=0)
    axis.set(xlabel="Temperature anomaly (°C)", ylabel="Probability density", xlim=limits)
    axis.legend(
        frameon=False,
        loc="lower center",
        bbox_to_anchor=(0.5, 1.01),
        fontsize=8,
        ncol=1,
    )
    finish_axis(axis)


def _timeline_axis(axis: plt.Axes, records: list[dict[str, object]]) -> None:
    """Draw the annual anomaly timeline with a provisional marker.

    Parameters
    ----------
    axis
        Target Matplotlib axis.
    records
        Seasonal anomaly records.
    """
    complete = [record for record in records if record["complete"]]
    years = np.array([record["year"] for record in complete], dtype=int)
    anomalies = np.array([record["anomaly_c"] for record in complete], dtype=float)
    colours = np.where(years <= 1990, HISTORICAL_COLOUR, RECENT_COLOUR)
    axis.bar(years, anomalies, width=0.84, color=colours, linewidth=0)
    provisional = [record for record in records if not record["complete"]]
    if provisional:
        record = provisional[0]
        axis.scatter(
            record["year"],
            record["anomaly_c"],
            marker="D",
            s=25,
            facecolor="white",
            edgecolor=PROVISIONAL_COLOUR,
            linewidth=1.2,
            zorder=3,
        )
        axis.annotate(
            f"{record['year']} to date\n{record['days_observed']}/{record['days_expected']} days",
            xy=(record["year"], record["anomaly_c"]),
            xytext=(-8, 12),
            textcoords="offset points",
            ha="right",
            va="bottom",
            color=PROVISIONAL_COLOUR,
            fontsize=7,
        )
    axis.axhline(0, color="#595959", lw=0.7, zorder=0)
    axis.set(xlabel="Year", ylabel="Temperature anomaly (°C)")
    finish_axis(axis)


def make_figure(
    records: list[dict[str, object]], summary: dict[str, object], destination: Path
) -> None:
    """Make one two-panel seasonal temperature figure.

    Parameters
    ----------
    records
        Seasonal anomaly records.
    summary
        Distribution summary statistics.
    destination
        Output stem; PDF and 300 dpi PNG are generated.
    """
    with publication_style(font_family="Nimbus Sans"):
        figure, axes = plt.subplots(
            1,
            2,
            figsize=(7.2, 3.05),
            gridspec_kw={"width_ratios": (1.0, 1.55)},
            constrained_layout=True,
        )
        _density_axis(axes[0], records, summary)
        _timeline_axis(axes[1], records)
        axes[0].text(
            0.98,
            0.97,
            f"Mean shift: +{summary['mean_shift_c']:.2f} °C",
            transform=axes[0].transAxes,
            ha="right",
            va="top",
            fontsize=8,
        )
        findings = audit_figure(figure, expected_font="Nimbus Sans")
        if findings:
            raise RuntimeError("Figure style audit failed:\n- " + "\n- ".join(findings))
        save_figure(figure, destination)
        plt.close(figure)


def make_all_figures(processed_dir: Path, figures_dir: Path) -> None:
    """Generate figures for every configured season.

    Parameters
    ----------
    processed_dir
        Directory containing ``analysis.json``.
    figures_dir
        Output directory for figure pairs.
    """
    payload = json.loads((processed_dir / "analysis.json").read_text(encoding="utf-8"))
    figures_dir.mkdir(parents=True, exist_ok=True)
    for key, season in payload["seasons"].items():
        make_figure(season["records"], season["summary"], figures_dir / key)
