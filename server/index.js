import express from "express";
import { SYSTEM_PROMPT } from "./prompt.js";

const app = express();
app.use(express.json({ limit: "20kb" }));

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const VERDICTS = ["credible", "suspicious", "uncertain"];

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

app.post("/api/verify", async (req, res) => {
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).json({ error: "Paste an alert to check." });
  if (text.length > 4000) return res.status(400).json({ error: "Alert is too long (4,000 characters max)." });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is missing. Add it to your .env file." });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: `Alert to verify:\n"""\n${text}\n"""` }] }],
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

    // Never trust model output shape: normalize before sending to the client.
    res.json({
      verdict: VERDICTS.includes(parsed.verdict) ? parsed.verdict : "uncertain",
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      explanation: String(parsed.explanation ?? "No explanation returned."),
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String).slice(0, 8) : [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not analyze that alert. Try again." });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`API listening on http://localhost:${port} (model: ${MODEL})`));
