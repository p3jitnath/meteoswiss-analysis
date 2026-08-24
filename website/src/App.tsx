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

/** Format a signed anomaly with a typographic sign. */
function signed(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} °C`;
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
        return <rect key={record.year} className="bar" x={x(record.year) - barWidth / 2} y={top} width={barWidth} height={Math.max(2, Math.abs(y(record.anomaly_c) - y(0)))} fill={colour} opacity={record.complete ? 0.88 : 0.58} stroke={record.complete ? "none" : PURPLE} strokeDasharray={record.complete ? undefined : "3 2"} tabIndex={0} onMouseEnter={() => onSelect(record)} onFocus={() => onSelect(record)}><title>{record.year}: {signed(record.anomaly_c)}</title></rect>;
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
  useEffect(() => { setSelected(latest); }, [latest]);
  if (!payload || !season) return <main className="loading">Loading MeteoSwiss analysis…</main>;
  const partial = season.records.find((record) => !record.complete);
  return (
    <>
      <header className="hero">
        <nav><span className="wordmark">Swiss climate / 1864–today</span><a href="https://github.com/p3jitnath/meteoswiss-analysis">Methods & code ↗</a></nav>
        <div className="hero-copy"><p className="eyebrow">Four stations. One unmistakable shift.</p><h1>Swiss summers<br /><em>have moved.</em></h1><p className="lede">The temperature distribution since 1991 sits <strong>{season.summary.mean_shift_c.toFixed(2)} °C warmer</strong> than the earlier record.</p></div>
      </header>
      <main>
        <section className="controls" aria-label="Season selection"><button className={seasonKey === "jja" ? "active" : ""} onClick={() => setSeasonKey("jja")}>Meteorological summer · JJA</button><button className={seasonKey === "apr_sep" ? "active" : ""} onClick={() => setSeasonKey("apr_sep")}>Warm half-year · Apr–Sep</button></section>
        <section className="metrics">
          <article><span>Mean shift</span><strong>+{season.summary.mean_shift_c.toFixed(2)}°</strong><small>1991–{season.summary.recent_period_end} vs 1864–1990</small></article>
          <article><span>Warmest complete season</span><strong>{season.summary.warmest_year}</strong><small>{signed(season.summary.warmest_anomaly_c)}</small></article>
          <article><span>Current view</span><strong>{partial ? signed(partial.anomaly_c) : "Complete"}</strong><small>{partial ? `${partial.days_observed} of ${partial.days_expected} days · provisional` : `through ${season.summary.recent_period_end}`}</small></article>
        </section>
        <section className="panel split"><div><p className="kicker">Then and now</p><h2>The whole distribution shifted right.</h2><p>Smoothed densities show complete seasons only. Dashed vertical reference marks zero: the 1961–1990 average.</p><div className="legend"><span><i className="blue" />1864–1990</span><span><i className="red" />1991–{season.summary.recent_period_end}</span></div></div><Distribution records={season.records} /></section>
        <section className="panel"><div className="section-head"><div><p className="kicker">Every year</p><h2>{season.summary.season_label} anomalies</h2></div><div className="selection" aria-live="polite"><b>{selected?.year}</b><strong>{selected && signed(selected.anomaly_c)}</strong><small>{selected?.complete ? `warm rank ${selected.rank}` : `${selected?.days_observed}/${selected?.days_expected} days, provisional`}</small></div></div><Timeline records={season.records} onSelect={setSelected} /><p className="hint">Hover or focus a bar to inspect a year. The outlined final bar is a like-for-like season-to-date anomaly and is not a completed-summer estimate.</p></section>
        <section className="method"><p className="kicker">Method</p><h2>Faithful to Schär et al., transparent about today.</h2><div className="method-grid"><p>We equally average homogeneous monthly 2 m air temperature from Basel/Binningen, Bern, Geneva and Zürich, then compute day-weighted seasonal means.</p><p>Completed-season anomalies use the 1961–1990 mean. The current incomplete season uses homogeneous daily values and the matching calendar window in each baseline year.</p><p>Source: MeteoSwiss open data. Daily homogeneous values are statistically derived; monthly data remain the recommended basis for climatological analysis.</p></div></section>
      </main>
      <footer><span>Data retrieved {season.summary.as_of}</span><span>Designed for evidence, not weather prediction.</span></footer>
    </>
  );
}
