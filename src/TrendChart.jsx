// Trend chart: how many checks came back as each verdict, per 15 minutes, over the last 6 hours.
// The numbers come from Tiger Data via GET /api/stats.
import { useEffect, useState } from "react";

const SERIES = [
  { key: "suspicious", label: "Likely misinformation", color: "var(--bad)" },
  { key: "uncertain", label: "Can't confirm", color: "var(--warn)" },
  { key: "credible", label: "Looks credible", color: "var(--ok)" },
];

// The database only returns time slots that had checks. Fill in the empty slots with zeros
// so the chart always shows the full 6 hours.
function fillSlots(data) {
  const step = data.bucketMinutes * 60_000;
  const count = (data.hours * 60) / data.bucketMinutes;
  const last = Math.floor(Date.now() / step) * step;
  const byTime = new Map(data.buckets.map((b) => [new Date(b.bucket).getTime(), b]));
  return Array.from({ length: count }, (_, i) => {
    const t = last - (count - 1 - i) * step;
    const b = byTime.get(t) ?? {};
    return { t, suspicious: b.suspicious ?? 0, uncertain: b.uncertain ?? 0, credible: b.credible ?? 0 };
  });
}

const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function TrendChart({ refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d); setError(d.error ?? ""); } })
      .catch(() => { if (alive) setError("Trends aren't available right now."); });
    return () => { alive = false; };
  }, [refreshKey]);

  let body;
  if (error) {
    body = <p className="muted">{error}</p>;
  } else if (!data) {
    body = <p className="muted">Loading trends…</p>;
  } else if (!data.enabled) {
    body = <p className="muted">Connect Tiger Data (DATABASE_URL in .env) to see live trends.</p>;
  } else {
    const slots = fillSlots(data);
    const totals = Object.fromEntries(SERIES.map((s) => [s.key, slots.reduce((n, x) => n + x[s.key], 0)]));
    const total = totals.suspicious + totals.uncertain + totals.credible;
    const max = Math.max(1, ...slots.map((x) => x.suspicious + x.uncertain + x.credible));

    const W = 480, H = 140, gap = 3;
    const barW = W / slots.length - gap;

    body = (
      <>
        <div className="trend-stats">
          <div><strong>{total}</strong><span>checks</span></div>
          <div><strong>{total ? Math.round((totals.suspicious / total) * 100) : 0}%</strong><span>misinformation</span></div>
          <div className="wide"><strong>{data.topFlag ? data.topFlag.flag : "None yet"}</strong><span>most common red flag</span></div>
        </div>
        <svg
          className="trend-chart"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${total} checks in the last ${data.hours} hours: ${totals.suspicious} likely misinformation, ${totals.uncertain} can't confirm, ${totals.credible} looks credible.`}
        >
          <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} className="axis" />
          {slots.map((slot, i) => {
            let y = H;
            return SERIES.map((s) => {
              const h = (slot[s.key] / max) * (H - 8);
              y -= h;
              return h > 0 ? (
                <rect key={`${i}-${s.key}`} x={i * (barW + gap)} y={y} width={barW} height={h} rx="2" fill={s.color}>
                  <title>{`${clock(slot.t)}: ${slot[s.key]} ${s.label.toLowerCase()}`}</title>
                </rect>
              ) : null;
            });
          })}
        </svg>
        <div className="trend-axis">
          <span>{clock(slots[0].t)}</span>
          <span>now</span>
        </div>
        <ul className="legend">
          {SERIES.map((s) => (
            <li key={s.key}><span className="swatch" style={{ background: s.color }} />{s.label}</li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <section className="panel trends" aria-label="Check trends">
      <div className="feed-head">
        <h2>Misinformation trends</h2>
        <p className="muted">Last 6 hours · stored in Tiger Data</p>
      </div>
      {body}
    </section>
  );
}
