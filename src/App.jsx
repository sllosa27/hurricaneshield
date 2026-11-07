import { useState } from "react";
import { DEMO_ALERTS } from "./demoAlerts.js";

const VERDICT_COPY = {
  suspicious: "Likely misinformation",
  credible: "Looks credible",
  uncertain: "Can't confirm",
};

export default function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
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
    </main>
  );
}
