import express from "express";
import { auth } from "express-oauth2-jwt-bearer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { getOfficialAlerts } from "./nws.js";
import { dbEnabled, getStats, saveCheck } from "./db.js";

const app = express();
app.use(express.json({ limit: "20kb" }));

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const VERDICTS = ["credible", "suspicious", "uncertain"];

// Auth0: only signed-in users may run a check.
// The browser sends an access token; this checks it was signed by our Auth0 tenant for our API.
const { AUTH0_DOMAIN, AUTH0_AUDIENCE } = process.env;
const requireLogin =
  AUTH0_DOMAIN && AUTH0_AUDIENCE
    ? auth({ issuerBaseURL: `https://${AUTH0_DOMAIN}`, audience: AUTH0_AUDIENCE })
    : (_req, res) => res.status(500).json({ error: "Auth0 is not set up. Add AUTH0_DOMAIN and AUTH0_AUDIENCE to .env." });
if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) console.warn("Warning: AUTH0_DOMAIN / AUTH0_AUDIENCE missing in .env, so checks are blocked.");

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

app.get("/api/official-alerts", async (_req, res) => {
  try {
    res.json(await getOfficialAlerts());
  } catch (err) {
    console.error("NWS error:", err.message);
    res.status(502).json({ error: "Could not reach the National Weather Service." });
  }
});

// Trend data for the chart (public: it only contains counts, nothing personal).
app.get("/api/stats", async (_req, res) => {
  if (!dbEnabled) return res.json({ enabled: false });
  try {
    res.json({ enabled: true, ...(await getStats()) });
  } catch (err) {
    console.error("Tiger Data stats failed:", err.message);
    res.status(502).json({ enabled: true, error: "Could not load trends from Tiger Data." });
  }
});

app.post("/api/verify", requireLogin, async (req, res) => {
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).json({ error: "Paste an alert to check." });
  if (text.length > 4000) return res.status(400).json({ error: "Alert is too long (4,000 characters max)." });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is missing. Add it to your .env file." });

  // Official context is a bonus: if NWS is down, still run the check without it.
  const official = await getOfficialAlerts().catch(() => null);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserMessage(text, official) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error("Gemini error", r.status, detail);
      return res.status(502).json({ error: `Gemini request failed (${r.status}). Check your API key and model name.` });
    }

    const data = await r.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const result = {
      verdict: VERDICTS.includes(parsed.verdict) ? parsed.verdict : "uncertain",
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      explanation: String(parsed.explanation ?? "No explanation returned."),
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String).slice(0, 8) : [],
      official_checked: Boolean(official),
    };

    // Save to Tiger Data for the trend chart. We wait so the chart refresh includes this check,
    // but saveCheck catches its own errors and times out after 5s, so a database problem never breaks a check.
    await saveCheck({
      userId: req.auth?.payload?.sub,
      verdict: result.verdict,
      confidence: result.confidence,
      redFlags: result.red_flags,
      officialChecked: result.official_checked,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not analyze that alert. Try again." });
  }
});

// Turn login errors (missing or bad token) into JSON the frontend can show, instead of an HTML error page.
app.use((err, _req, res, next) => {
  if (!err.status || err.status >= 500) return next(err);
  const message = err.status === 401 ? "Please log in to check alerts." : "Request was rejected. Try logging in again.";
  res.status(err.status).json({ error: message });
});

// After `npm run build`, serve the built site too (this is also how it runs when deployed).
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`API listening on http://localhost:${port} (model: ${MODEL})`));
