# HurricaneShield

Paste a storm alert, get a verdict (credible / suspicious / uncertain), a confidence score, and a plain-language explanation.

## Run it
1. `npm install`
2. `cp .env.example .env` and add your Gemini API key
3. `npm run dev`, then open http://localhost:5173

Requires Node 20.6+ (uses `--env-file`).

## Challenge map (fill in as you build)
- Gemini API: `server/index.js`, `server/prompt.js`
- EC-Council: _offline support (hours 4-5)_
- Auth0: _hours 6-7_
- Tiger Data: _hours 8-9_
- Swarms API: _hours 10-11_
- SpaceXSI: see `NOTES.md`
