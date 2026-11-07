import { useEffect, useState } from "react";
import { DEMO_ALERTS } from "./demoAlerts.js";
import { loadOfficial, offlineVerdict, saveOfficial } from "./offline.js";

const VERDICT_COPY = {
  suspicious: "Likely misinformation",
  credible: "Looks credible",
  uncertain: "Can't confirm",
};

function timeAgo(ms) {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
}

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [official, setOfficial] = useState(null); // { area, alerts, savedAt, fromCache }

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const r = await fetch("/api/official-alerts");
        if (!r.ok) throw new Error("NWS unavailable");
        const data = await r.json();
        saveOfficial(data);
        setOfficial({ ...data, savedAt: Date.now(), fromCache: false });
      } catch {
        const saved = loadOfficial();
        setOfficial(saved ? { ...saved, fromCache: true } : null);
      }
    }
    loadAlerts();
  }, [online]);

  async function check() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (!navigator.onLine) throw new TypeError("offline");
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (r.status >= 500) throw new TypeError(data.error || "server unavailable");
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (e) {
      if (e instanceof TypeError || e instanceof SyntaxError) {
        setResult(offlineVerdict(text, official ?? loadOfficial()));
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      {!online && (
        <p className="banner" role="status">
          You're offline. Checks use basic rules and your last saved official alerts.
        </p>
      )}

      <header className="masthead">
        <h1>HurricaneShield</h1>
        <p>Paste a storm alert. We check whether it holds up before you share it.</p>
      </header>

      <section className="intake" aria-label="Alert to check">
        <div className="samples">
          <span>Try a sample:</span>
          {DEMO_ALERTS.map((a) => (
            <button key={a.label} className="chip" onClick={() => { setText(a.text); setResult(null); setError(""); }}>
              {a.label}
            </button>
          ))}
        </div>
        <label htmlFor="alert" className="sr-only">Alert text</label>
        <textarea
          id="alert"
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the message you received (text, social post, forwarded chat)…"
        />
        <button className="primary" onClick={check} disabled={loading || !text.trim()}>
          {loading ? "Checking alert…" : "Check this alert"}
        </button>
        {error && <p role="alert" className="error">{error}</p>}
      </section>

      {result && (
        <section className={`verdict ${result.verdict}`} aria-live="polite">
          {result.mode === "offline" && (
            <p className="mode">Basic check: the AI check wasn't reachable, so this uses simple rules.</p>
          )}
          <div className="verdict-head">
            <h2>{VERDICT_COPY[result.verdict]}</h2>
            <p className="conf">{Math.round(result.confidence * 100)}% confidence</p>
          </div>
          <p className="explain">{result.explanation}</p>
          {result.red_flags.length > 0 && (
            <ul className="flags">
              {result.red_flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          <p className="official">
            Always confirm with <a href="https://www.hurricanes.gov" target="_blank" rel="noreferrer">hurricanes.gov</a> and{" "}
            <a href="https://www.weather.gov" target="_blank" rel="noreferrer">weather.gov</a>.
          </p>
        </section>
      )}

      <section className="feed" aria-label="Official alerts">
        <h2>Official alerts right now{official ? ` (${official.area})` : ""}</h2>
        {!official && <p className="muted">Official alerts couldn't be loaded, and there's no saved copy yet.</p>}
        {official && (
          <>
            <p className="muted">
              National Weather Service.{" "}
              {official.fromCache ? `Saved copy from ${timeAgo(official.savedAt)}.` : "Updated just now."}
            </p>
            {official.alerts.length === 0 ? (
              <p>No active alerts for this area.</p>
            ) : (
              <ul className="alerts">
                {official.alerts.map((a) => (
                  <li key={a.id}>
                    <strong>{a.event}</strong>
                    <span>{a.areaDesc}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
