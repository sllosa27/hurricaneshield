// Offline support: remembers the last official alerts and gives a basic verdict with no AI or internet.

const KEY = "hs_official_v1";

export function saveOfficial(payload) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...payload, savedAt: Date.now() })); } catch { /* storage full or blocked */ }
}

export function loadOfficial() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

const RED_FLAGS = [
  [/share (this )?before|before (it('s| is|s) )?(deleted|taken down)/i, "Pressure to share before it gets deleted"],
  [/they (don'?t|do not) want you to know|government is hiding|cover[- ]?up/i, "Claims of a cover-up"],
  [/category\s*[6-9]\b/i, "Impossible hurricane category"],
  [/\$\s?\d+|send (money|cash)|gift card|bitcoin|venmo|cashapp/i, "Asks for money"],
  [/bit\.ly|tinyurl|t\.co\/|goo\.gl/i, "Shortened link hides where it goes"],
  [/!{3,}/, "Lots of exclamation marks"],
  [/\b(or die|you will die|everyone will die)\b/i, "Threatening language"],
];
const CRED_FLAGS = /\b(national hurricane center|nhc|national weather service|nws|noaa|hurricanes\.gov|weather\.gov|emergency management)\b/i;

export function offlineVerdict(text, official) {
  const flags = RED_FLAGS.filter(([re]) => re.test(text)).map(([, label]) => label);

  const letters = text.replace(/[^a-z]/gi, "");
  const caps = letters.length > 20 ? letters.replace(/[^A-Z]/g, "").length / letters.length : 0;
  if (caps > 0.5) flags.push("Mostly ALL CAPS");

  const namesSource = CRED_FLAGS.test(text);
  if (!namesSource) flags.push("Does not name an official source");

  const lower = text.toLowerCase();
  const match = official?.alerts?.find((a) => a.event && lower.includes(a.event.toLowerCase()));

  const hard = flags.filter((f) => f !== "Does not name an official source").length;
  let verdict = "uncertain";
  let confidence = 0.5;
  if (hard >= 2) { verdict = "suspicious"; confidence = Math.min(0.8, 0.5 + hard * 0.1); }
  else if (hard === 0 && namesSource) { verdict = "credible"; confidence = match ? 0.7 : 0.55; }

  const explanation =
    verdict === "suspicious"
      ? "This message has several warning signs that official alerts normally don't have."
      : verdict === "credible"
      ? "The wording looks like an official alert and names an official source." +
        (match ? ` It also matches a saved official alert (${match.event}).` : "")
      : "There isn't enough in the text alone to judge this message.";

  return { verdict, confidence, explanation, red_flags: flags, mode: "offline" };
}
