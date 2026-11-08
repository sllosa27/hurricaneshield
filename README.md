# HurricaneShield

Paste a storm alert, get a verdict (credible / suspicious / uncertain), a confidence score, and a plain-language explanation.

## Run it
1. `npm install`
2. `cp .env.example .env` and add your Gemini API key
3. `npm run dev`, then open http://localhost:5173

Requires Node 20.6+ (uses `--env-file`).

### Auth0 setup
Running a check requires login. Official alerts stay public.
1. In Auth0, create a **Single Page Application**. Set Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins to `http://localhost:5173/`.
2. Create an **API** with identifier `https://hurricaneshield-api` (RS256).
3. Fill in the `AUTH0_*` and `VITE_AUTH0_*` values in `.env` (see `.env.example`).

### Tiger Data setup
1. Create a free service at tigerdata.com (Tiger Cloud).
2. Copy its connection string into `.env` as `DATABASE_URL=...` (it contains a password, so never commit or share it).
3. Run `npm install`, restart the app, and run a check. The table is created automatically.

## Challenge map (fill in as you build)
- Gemini API: `server/index.js`, `server/prompt.js`
- EC-Council: _offline support (hours 4-5)_
- Auth0: login required to run a check. Server guard in `server/index.js` (`requireLogin`), login UI in `src/main.jsx` and `src/App.jsx`
- Tiger Data: every AI check (verdict, confidence, red flags; not the alert text) is saved to a hypertable and charted with `time_bucket()`. See `server/db.js`, `src/TrendChart.jsx`
- Swarms API: _hours 10-11_
- SpaceXSI: see `NOTES.md`
