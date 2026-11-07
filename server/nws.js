// Pulls active alerts from the National Weather Service (free, no key needed).
// NWS asks every app to send a User-Agent that identifies it.

const AREA = process.env.OFFICIAL_AREA || "FL";
const USER_AGENT = process.env.NWS_USER_AGENT || "HurricaneShield-hackathon (student project)";
const TTL_MS = 2 * 60 * 1000;

let cache = { at: 0, data: null };

export async function getOfficialAlerts() {
  if (cache.data && Date.now() - cache.at < TTL_MS) return cache.data;

  const r = await fetch(`https://api.weather.gov/alerts/active?area=${encodeURIComponent(AREA)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/geo+json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`NWS responded ${r.status}`);

  const json = await r.json();
  const alerts = (json.features ?? []).slice(0, 40).map((f) => ({
    id: f.properties.id,
    event: f.properties.event,
    severity: f.properties.severity,
    headline: f.properties.headline,
    areaDesc: f.properties.areaDesc,
    expires: f.properties.expires,
    sender: f.properties.senderName,
  }));

  // Put storm-related alerts first so they survive the length cap.
  const storm = /hurricane|tropical|storm surge|flood|tornado|wind|surge/i;
  alerts.sort((a, b) => Number(storm.test(b.event)) - Number(storm.test(a.event)));

  cache = { at: Date.now(), data: { area: AREA, fetchedAt: new Date().toISOString(), alerts: alerts.slice(0, 15) } };
  return cache.data;
}
