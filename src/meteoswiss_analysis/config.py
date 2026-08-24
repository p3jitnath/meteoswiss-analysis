"""Configuration shared by the acquisition and analysis pipelines."""

from dataclasses import dataclass

STAC_COLLECTION = "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-nbcn"
DATA_ROOT = "https://data.geo.admin.ch/ch.meteoschweiz.ogd-nbcn"
STATIONS = ("bas", "ber", "gve", "sma")
STATION_NAMES = {
    "bas": "Basel / Binningen",
    "ber": "Bern / Zollikofen",
    "gve": "Geneva / Cointrin",
    "sma": "Zürich / Fluntern",
}
MONTHLY_TEMPERATURE = "ths200m0"
DAILY_TEMPERATURE = "ths200d0"
BASELINE_START = 1961
BASELINE_END = 1990
RECENT_START = 1991


@dataclass(frozen=True)
class SeasonDefinition:
    """Describe a contiguous set of calendar months.

    Parameters
    ----------
    key
        Stable machine-readable season identifier.
    label
        Human-readable season label.
    months
        Calendar month numbers included in the season.
    """

    key: str
    label: str
    months: tuple[int, ...]


SEASONS = {
    "jja": SeasonDefinition("jja", "June–August (JJA)", (6, 7, 8)),
    "apr_sep": SeasonDefinition("apr_sep", "April–September", (4, 5, 6, 7, 8, 9)),
}
