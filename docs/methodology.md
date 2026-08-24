# Methodology

The analysis reproduces the station-series approach described in Figure 1 of Schär et al.
(2004), using current MeteoSwiss homogeneous records.

1. Download monthly homogeneous mean 2 m air temperature (`ths200m0`) for `BAS`, `BER`,
   `GVE`, and `SMA` from the Swiss NBCN STAC collection.
2. At each month, take the unweighted arithmetic mean of the four stations. Equal weighting
   prevents a single local series from dominating the composite.
3. Compute seasonal means using calendar days per month as weights. Require every month of
   the season; incomplete monthly seasons are excluded.
4. Subtract the composite 1961–1990 seasonal mean.
5. Compare complete 1864–1990 and 1991–latest distributions, reporting sample standard
   deviations (`ddof=1`) and fitting Gaussian densities with sample mean and standard deviation.

During an incomplete current season, the displayed point uses daily homogeneous mean 2 m
temperature (`ths200d0`). The comparison baseline is truncated to exactly the same sequence of
calendar days in each year from 1961 through 1990. This value describes conditions *to date*;
it is not an estimate of the final seasonal mean and is excluded from ranks and densities.

Important differences from the 2004 paper are explicit: the MeteoSwiss NBCN dataset is revised
and continuously homogenised; Bern's homogeneous continuation is now identified as
Bern/Zollikofen rather than Bern/Liebefeld; and the current pipeline uses MeteoSwiss's directly
published homogeneous mean temperature rather than reconstructing monthly mean temperature
from daily minima and maxima.
