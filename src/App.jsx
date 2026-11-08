import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { DEMO_ALERTS } from "./demoAlerts.js";
import TrendChart from "./TrendChart.jsx";
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

function RadarMark() {
  return (
    <svg className="mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <path d="M24 24 L24 5 A19 19 0 0 1 40.5 14.5 Z" fill="currentColor" opacity="0.85" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" />
    </svg>
  );
}

function Radar({ mode }) {
  return (
    <svg className={`radar ${mode}`} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" className="ring" />
      <circle cx="100" cy="100" r="62" className="ring" />
      <circle cx="100" cy="100" r="32" className="ring" />
      <line x1="100" y1="8" x2="100" y2="192" className="ring" />
      <line x1="8" y1="100" x2="192" y2="100" className="ring" />
      <g className="sweep">
        <path d="M100 100 L100 8 A92 92 0 0 1 165 35 Z" fill="url(#sweepGrad)" />
      </g>
      <circle cx="100" cy="100" r="3" fill="currentColor" />
    </svg>
  );
}

export default function App() {
  // Login state from Auth0. getAccessTokenSilently gives us the "pass" to send to our server.
  const { isAuthenticated, isLoading: authLoading, user, loginWithRedirect, logout, getAccessTokenSilently, error: authError } = useAuth0();
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [official, setOfficial] = useState(null); // { area, alerts, savedAt, fromCache }
  const [statsVersion, setStatsVersion] = useState(0); // bump to reload the trend chart

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
      const token = await getAccessTokenSilently();
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (r.status >= 500) throw new TypeError(data.error || "server unavailable");
      if (!r.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data);
      setStatsVersion((v) => v + 1); // a new check was saved, so refresh the chart
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

  const pct = result ? Math.round(result.confidence * 100) : 0;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <RadarMark />
          <div>
            <h1>HurricaneShield</h1>
            <p>Storm alert verification</p>
          </div>
        </div>
        <div className="top-right">
          <div className={`status ${online ? "on" : "off"}`} role="status">
            <span className="dot" />
            {online ? "Online" : "Offline mode"}
          </div>
          {!authLoading && (isAuthenticated ? (
            <div className="account">
              <span className="who">{user?.email || user?.name}</span>
              <button className="ghost" onClick={() => logout({ logoutParams: { returnTo: window.location.origin + "/" } })}>
                Log out
              </button>
            </div>
          ) : (
            <button className="ghost" onClick={() => loginWithRedirect()}>Log in</button>
          ))}
        </div>
      </header>

      {!online && (
        <p className="banner">You're offline. Checks use basic rules and your last saved official alerts.</p>
      )}

      <main className="grid">
        <section className="panel intake" aria-label="Alert to check">
          <p className="eyebrow">Step 1: Paste the message</p>
          <label htmlFor="alert" className="sr-only">Alert text</label>
          <textarea
            id="alert"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the alert you received: a text, social post, or forwarded chat…"
          />
          <div className="samples">
            <span>Or try a sample:</span>
            {DEMO_ALERTS.map((a) => (
              <button key={a.label} className="chip" onClick={() => { setText(a.text); setResult(null); setError(""); }}>
                {a.label}
              </button>
            ))}
          </div>
          {isAuthenticated ? (
            <button className="primary" onClick={check} disabled={loading || !text.trim()}>
              {loading ? "Analyzing…" : "Check this alert"}
            </button>
          ) : (
            <>
              <button className="primary" onClick={() => loginWithRedirect()} disabled={authLoading}>
                Log in to check
              </button>
              <p className="muted">Sign in to run a check. The official alerts below are open to everyone.</p>
              {authError && <p role="alert" className="error">Login problem: {authError.message}</p>}
            </>
          )}
          {error && <p role="alert" className="error">{error}</p>}
        </section>

        <section className="panel readout" aria-label="Verdict" aria-live="polite">
          <p className="eyebrow">Step 2: Verdict</p>

          {!result && (
            <div className="idle">
              <Radar mode={loading ? "scanning" : "idle"} />
              <p className="idle-title">{loading ? "Analyzing alert…" : "Awaiting alert"}</p>
              <p className="idle-sub">
                {loading
                  ? "Comparing it against official sources."
                  : "Paste a message and run a check to see the verdict here."}
              </p>
            </div>
          )}

          {result && (
            <div className={`result v-${result.verdict}`}>
              <h2 className="verdict-word">{VERDICT_COPY[result.verdict]}</h2>
              <div className="meter-row">
                <div className="meter" role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="pct">{pct}%</span>
              </div>
              <div className="tags">
                {result.mode === "offline" ? (
                  <span className="tag warn">Offline rules, no AI</span>
                ) : (
                  <span className="tag">AI analysis</span>
                )}
                {result.official_checked && <span className="tag">Cross-checked with live NWS alerts</span>}
              </div>
              <p className="explain">{result.explanation}</p>
              {result.red_flags.length > 0 && (
                <ul className="flags">
                  {result.red_flags.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              <p className="confirm">
                Always confirm with <a href="https://www.hurricanes.gov" target="_blank" rel="noreferrer">hurricanes.gov</a> and{" "}
                <a href="https://www.weather.gov" target="_blank" rel="noreferrer">weather.gov</a>.
              </p>
            </div>
          )}
        </section>
      </main>

      <TrendChart refreshKey={statsVersion} />

      <section className="panel feed" aria-label="Official alerts">
        <div className="feed-head">
          <h2>Official alerts right now{official ? ` · ${official.area}` : ""}</h2>
          {official && (
            <p className="muted">
              National Weather Service ·{" "}
              {official.fromCache ? `saved copy from ${timeAgo(official.savedAt)}` : "updated just now"}
            </p>
          )}
        </div>
        {!official && <p className="muted">Official alerts couldn't be loaded, and there's no saved copy yet.</p>}
        {official && official.alerts.length === 0 && <p>No active alerts for this area.</p>}
        {official && official.alerts.length > 0 && (
          <ul className="alerts">
            {official.alerts.map((a) => (
              <li key={a.id}>
                <div className="alert-top">
                  <strong>{a.event}</strong>
                  {a.severity && <span className={`sev sev-${a.severity.toLowerCase()}`}>{a.severity}</span>}
                </div>
                <span className="area">{a.areaDesc}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
