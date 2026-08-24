import { useEffect, useMemo, useState } from "react";
import { extent, max, mean } from "d3-array";
import { scaleLinear } from "d3-scale";
import { area, curveBasis, line } from "d3-shape";

type Record = {
  year: number;
  temperature_c: number;
  anomaly_c: number;
  period: "historical" | "recent" | "provisional";
  complete: boolean;
  days_observed: number;
  days_expected: number;
  rank: number | null;
};

type Summary = {
  season_label: string;
  recent_period_end: number;
  mean_shift_c: number;
  warmest_year: number;
  warmest_anomaly_c: number;
  historical_std_c: number;
  recent_std_c: number;
  as_of: string;
};

type Season = { summary: Summary; records: Record[] };
type Payload = {
  metadata: { source: string; stations: string[]; method: string };
  seasons: { jja: Season; apr_sep: Season };
};

const BLUE = "#3265a8";
const RED = "#d64c45";
const PURPLE = "#74518c";

/** Render the GitHub mark with an accessible label inherited from its link. */
function GitHubMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="github-mark"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.24c-3.24.7-3.92-1.37-3.92-1.37-.53-1.35-1.29-1.71-1.29-1.71-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.4-1.27.74-1.56-2.59-.29-5.31-1.29-5.31-5.69 0-1.26.45-2.29 1.2-3.09-.12-.29-.52-1.48.11-3.05 0 0 .98-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.19-1.49 3.17-1.18 3.17-1.18.63 1.57.23 2.76.11 3.05.75.8 1.2 1.83 1.2 3.09 0 4.41-2.73 5.39-5.32 5.68.42.36.79 1.07.79 2.16v3.27c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" /></svg>;
}

/** Render a font-independent northeast arrow. */
function ArrowMark() {
  return <svg className="arrow-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M7 5h8v8" /></svg>;
}

/** Format a signed anomaly with a typographic sign. */
function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} °C`;
}

/** Animate a tabular statistic while respecting reduced-motion preferences. */
function CountUp({ value, decimals = 0, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (time: number) => {
      const progress = reducedMotion ? 1 : Math.min((time - start) / 1100, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span aria-label={`${prefix}${value.toFixed(decimals)}${suffix}`}>{prefix}{display.toFixed(decimals)}{suffix}</span>;
}

/** Approximate a smooth empirical density using Gaussian kernels. */
function density(values: number[], domain: [number, number]): [number, number][] {
  const bandwidth = 0.32;
  return Array.from({ length: 100 }, (_, index) => {
    const x = domain[0] + ((domain[1] - domain[0]) * index) / 99;
    const y = mean(values, (value) =>
      Math.exp(-0.5 * ((x - value) / bandwidth) ** 2) /
      (bandwidth * Math.sqrt(2 * Math.PI)),
    ) ?? 0;
    return [x, y];
  });
}

/** Render the historical and recent anomaly distributions. */
function Distribution({ records }: { records: Record[] }) {
  const width = 620;
  const height = 330;
  const margin = { top: 18, right: 18, bottom: 46, left: 52 };
  const historical = records.filter((record) => record.complete && record.year <= 1990).map((record) => record.anomaly_c);
  const recent = records.filter((record) => record.complete && record.year >= 1991).map((record) => record.anomaly_c);
  const bounds = extent([...historical, ...recent]) as [number, number];
  const domain: [number, number] = [Math.floor(bounds[0] - 0.5), Math.ceil(bounds[1] + 0.5)];
  const first = density(historical, domain);
  const second = density(recent, domain);
  const yMaximum = max([...first, ...second], (point) => point[1]) ?? 1;
  const x = scaleLinear(domain, [margin.left, width - margin.right]);
  const y = scaleLinear([0, yMaximum * 1.08], [height - margin.bottom, margin.top]);
  const shape = area<[number, number]>().x((point) => x(point[0])).y0(y(0)).y1((point) => y(point[1])).curve(curveBasis);
  const stroke = line<[number, number]>().x((point) => x(point[0])).y((point) => y(point[1])).curve(curveBasis);
  const ticks = x.ticks(7);
  return (
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Temperature anomaly distributions before and after 1991">
        <line className="zero" x1={x(0)} x2={x(0)} y1={margin.top} y2={height - margin.bottom} />
        <path d={shape(first) ?? ""} fill={BLUE} opacity="0.16" />
        <path d={shape(second) ?? ""} fill={RED} opacity="0.17" />
        <path d={stroke(first) ?? ""} fill="none" stroke={BLUE} strokeWidth="3" />
        <path d={stroke(second) ?? ""} fill="none" stroke={RED} strokeWidth="3" />
        {ticks.map((tick) => <g key={tick}><line className="tick" x1={x(tick)} x2={x(tick)} y1={height - margin.bottom} y2={height - margin.bottom + 6} /><text x={x(tick)} y={height - 19} textAnchor="middle">{tick}</text></g>)}
        <text x={width / 2} y={height - 1} textAnchor="middle" className="axis-label">Anomaly relative to 1961–1990 (°C)</text>
      </svg>
  );
}

/** Render annual anomalies with hover and keyboard details. */
function Timeline({ records, onSelect }: { records: Record[]; onSelect: (record: Record) => void }) {
  const width = 1100;
  const height = 350;
  const margin = { top: 18, right: 18, bottom: 46, left: 52 };
  const bounds = extent(records, (record) => record.anomaly_c) as [number, number];
  const x = scaleLinear(extent(records, (record) => record.year) as [number, number], [margin.left, width - margin.right]);
  const y = scaleLinear([Math.floor(bounds[0] - 0.3), Math.ceil(bounds[1] + 0.3)], [height - margin.bottom, margin.top]);
  const barWidth = Math.max(2, (width - margin.left - margin.right) / records.length - 0.7);
  return (
    <svg className="chart timeline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Annual Swiss seasonal temperature anomalies since 1864">
      <line className="zero" x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} />
      {records.map((record) => {
        const colour = record.complete ? (record.year <= 1990 ? BLUE : RED) : PURPLE;
        const top = record.anomaly_c >= 0 ? y(record.anomaly_c) : y(0);
        return <rect key={record.year} className="bar" x={x(record.year) - barWidth / 2} y={top} width={barWidth} height={Math.max(2, Math.abs(y(record.anomaly_c) - y(0)))} fill={colour} opacity={record.complete ? 0.88 : 0.58} stroke={record.complete ? "none" : PURPLE} strokeDasharray={record.complete ? undefined : "3 2"} tabIndex={0} onClick={() => onSelect(record)} onMouseEnter={() => onSelect(record)} onFocus={() => onSelect(record)}><title>{record.year}: {signed(record.anomaly_c)}</title></rect>;
      })}
      {[1864, 1900, 1950, 1990, 2026].map((tick) => <text key={tick} x={x(tick)} y={height - 18} textAnchor="middle">{tick}</text>)}
      <text x={width / 2} y={height - 1} textAnchor="middle" className="axis-label">Year</text>
    </svg>
  );
}

/** Load the generated analysis and render the interactive story. */
export default function App() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [seasonKey, setSeasonKey] = useState<"jja" | "apr_sep">("jja");
  const [selected, setSelected] = useState<Record | null>(null);
  useEffect(() => { fetch("./data/analysis.json").then((response) => response.json()).then(setPayload); }, []);
  const season = payload?.seasons[seasonKey];
  const latest = useMemo(() => season?.records.at(-1) ?? null, [season]);
  useEffect(() => {
    document.documentElement.dataset.reveal = "enabled";
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements.forEach((element) => observer.observe(element));
    const toggleGrid = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key.toLowerCase() === "g" && !target.matches("input, textarea, select")) {
        document.documentElement.toggleAttribute("data-grid");
      }
    };
    window.addEventListener("keydown", toggleGrid);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", toggleGrid);
    };
  }, [payload, seasonKey]);
  if (!payload || !season) return <main className="loading">Loading MeteoSwiss analysis…</main>;
  const partial = season.records.find((record) => !record.complete);
  const displayed = selected ?? latest;
  return (
    <>
      <div className="grid-overlay" aria-hidden="true" />
      <header className="site-header">
        <nav className="topbar"><a className="identity" href="#top" aria-label="Swiss Climate Analysis home"><span className="identity-mark"><span className="identity-flag" role="img" aria-label="Switzerland">🇨🇭</span>Swiss Climate</span><span className="identity-unit"><b>Temperature analysis</b><small>Open research report</small></span></a><div className="nav-links"><a href="#findings">Findings</a><a href="#methods">Methods</a><a href="#data">Data</a><a className="code-link" href="https://github.com/p3jitnath/meteoswiss-analysis" aria-label="View source code on GitHub"><GitHubMark /><span>Code</span></a></div></nav>
      </header>
      <header className="report-header" id="top" data-reveal>
        <div className="report-meta"><span>Research brief</span><span>24 August 2026</span><span>Version 1.0</span></div><p className="eyebrow">Observed climate change · Switzerland</p><h1>The shifting distribution of Swiss summer temperatures since 1864</h1><p className="dek">An updated four-station analysis of homogeneous 2 m air temperature records shows that recent Swiss summers occupy a substantially warmer climate regime.</p><div className="byline"><span>Analysis by Pritthijit Nath</span><span>Data: Federal Office of Meteorology and Climatology MeteoSwiss</span></div>
      </header>
      <main>
        <section className="abstract" data-reveal><p className="section-label">Abstract</p><p>We update the observational analysis of Schär et al. (2004) using homogeneous temperature records from Basel, Bern, Geneva and Zürich. Complete June–August seasons from 1991–{payload.seasons.jja.summary.recent_period_end} average <strong>{payload.seasons.jja.summary.mean_shift_c.toFixed(2)} °C warmer</strong> than the 1864–1990 record. The interactive results distinguish completed seasons from an explicitly provisional 2026 season-to-date value.</p></section>
        <section className="controls" aria-label="Season selection" data-reveal><button className={seasonKey === "jja" ? "active" : ""} onClick={() => { setSeasonKey("jja"); setSelected(null); }}>Meteorological summer · JJA</button><button className={seasonKey === "apr_sep" ? "active" : ""} onClick={() => { setSeasonKey("apr_sep"); setSelected(null); }}>Warm half-year · Apr–Sep</button></section>
        <section className="metrics" id="findings" data-reveal>
          <article><span>Mean shift</span><strong><CountUp value={season.summary.mean_shift_c} decimals={2} prefix="+" suffix="°" /></strong><small>1991–{season.summary.recent_period_end} vs 1864–1990</small></article>
          <article><span>Warmest complete season</span><strong><CountUp value={season.summary.warmest_year} /></strong><small>{signed(season.summary.warmest_anomaly_c)}</small></article>
          <article><span>Current view</span><strong>{partial ? <CountUp value={Math.abs(partial.anomaly_c)} decimals={2} prefix={partial.anomaly_c >= 0 ? "+" : "−"} suffix=" °C" /> : "Complete"}</strong><small>{partial ? `${partial.days_observed} of ${partial.days_expected} days · provisional` : `through ${season.summary.recent_period_end}`}</small></article>
        </section>
        <figure className="panel split" data-reveal><figcaption><p className="figure-number">01 / Distribution</p><h2>The complete distribution has shifted towards warmer summers</h2><p>Kernel-density estimates include completed seasons only. The vertical reference denotes the 1961–1990 mean. Curves describe observed variability and do not represent forecasts.</p><div className="legend"><span><i className="blue" />1864–1990</span><span><i className="red" />1991–{season.summary.recent_period_end}</span></div></figcaption><Distribution records={season.records} /></figure>
        <figure className="panel timeline-panel" data-reveal><div className="section-head"><figcaption><p className="figure-number">02 / Annual record</p><h2>Annual {season.summary.season_label} temperature anomalies</h2></figcaption><div className="selection" aria-live="polite"><b>{displayed?.year}</b><strong>{displayed && signed(displayed.anomaly_c)}</strong><small>{displayed?.complete ? `warm rank ${displayed.rank}` : `${displayed?.days_observed}/${displayed?.days_expected} days, provisional`}</small></div></div><label className="mobile-year-picker"><span>Choose a year</span><select value={displayed?.year ?? ""} onChange={(event) => setSelected(season.records.find((record) => record.year === Number(event.target.value)) ?? null)}>{[...season.records].reverse().map((record) => <option key={record.year} value={record.year}>{record.year} · {signed(record.anomaly_c)}{record.complete ? "" : " · provisional"}</option>)}</select></label><div className="timeline-scroll"><Timeline records={season.records} onSelect={setSelected} /></div><p className="hint">Interactive: choose a year, or hover, tap or focus a bar. The outlined final bar is a like-for-like season-to-date anomaly and is not an estimate of the final summer mean.</p></figure>
        <section className="method" id="methods" data-reveal><p className="section-label">03 / Methods</p><h2>Reproducible station-based analysis</h2><div className="method-grid"><div><b>Observations</b><p>Homogeneous monthly mean 2 m air temperature from Basel/Binningen, Bern/Zollikofen, Geneva/Cointrin and Zürich/Fluntern.</p></div><div><b>Aggregation</b><p>Stations receive equal weight. Monthly station composites are weighted by calendar days to obtain seasonal means.</p></div><div><b>Reference and provisional data</b><p>Completed anomalies use 1961–1990. The incomplete season uses daily values and the matching baseline calendar window; it is excluded from ranks and densities.</p></div></div></section>
        <section className="data-section" id="data" data-reveal><div><p className="section-label">04 / Data and reproducibility</p><h2>Every result is inspectable.</h2><p>Source data, processed tables, figure-generation code and the complete web application are versioned together. Automated tests verify seasonal weighting and incomplete-season handling.</p></div><div className="download-list"><a href="./data/analysis.json" download><span>Analysis dataset<small>JSON · machine readable</small></span><ArrowMark /></a><a href="https://github.com/p3jitnath/meteoswiss-analysis/tree/main/figures"><span>Publication figures<small>PDF + 300 dpi PNG</small></span><ArrowMark /></a><a href="https://github.com/p3jitnath/meteoswiss-analysis/blob/main/docs/methodology.md"><span>Full methodology<small>Assumptions and differences</small></span><ArrowMark /></a></div></section>
        <section className="citation" data-reveal><p className="section-label">Reference</p><p>Schär, C. et al. (2004). The role of increasing temperature variability in European summer heatwaves. <em>Nature</em> 427, 332–336. <a href="https://doi.org/10.1038/nature02300">doi:10.1038/nature02300</a>.</p></section>
      </main>
      <footer><span>Data retrieved {season.summary.as_of} · Source: MeteoSwiss · Code licensed under MIT</span><span className="footer-links"><a href="https://github.com/p3jitnath/meteoswiss-analysis/blob/main/LICENSE">MIT licence</a><a className="footer-code" href="https://github.com/p3jitnath/meteoswiss-analysis"><GitHubMark /> Source code</a></span></footer>
    </>
  );
}
