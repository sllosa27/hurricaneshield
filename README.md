# HurricaneShield

Paste a storm alert and get a verdict (credible / suspicious / uncertain), a confidence score, and a plain-language explanation of why.

## Run it

Requires Node 20.6+ (uses `--env-file`).

1. `npm install`
2. Copy `.env.example` to `.env` and add your Gemini API key
   - Mac/Linux/PowerShell: `cp .env.example .env`
   - Windows Command Prompt: `copy .env.example .env`
3. `npm run dev`
4. Open http://localhost:5173

The app runs on port 5173 and the API on port 8787.

## Auth0 setup

Running a check requires login. Official alerts stay public.

1. In Auth0, create a Single Page Application. Set Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins to `http://localhost:5173/`.
2. Create an API with identifier `https://hurricaneshield-api` (RS256).
3. Fill in the `AUTH0_*` and `VITE_AUTH0_*` values in `.env` (see `.env.example`).

## Tiger Data setup

1. Create a free service at tigerdata.com (Tiger Cloud).
2. Copy its connection string into `.env` as `DATABASE_URL=...`. It contains a password, so never commit or share it.
3. Run `npm install`, restart the app, and run a check. The table is created automatically.

## Swarms API 
 **Swarms API:** a swarm of AI agents reviews each storm alert from different angles (for example, source credibility, language and tone, and consistency with official data) and their findings are combined into the final verdict. Requires `SWARMS_API_KEY` in `.env`. See `server/swarm.js`.

## Deploy (Render)
The Express server also serves the built website, so the whole app is one Render "Web Service".
1. On render.com: **New > Web Service**, connect this GitHub repo, branch `main`.
2. Build command: `npm install --include=dev && npm run build`
3. Start command: `npm start`
4. In the service's **Environment** tab, add the same values as `.env` (Gemini, Auth0, `DATABASE_URL`). Never commit them.
5. In Auth0 (HurricaneShield app), add `https://<your-app>.onrender.com/` to Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins.
6. Every merge to `main` redeploys automatically. The free plan sleeps after 15 minutes idle, so open the site a minute before a demo.

## How it works

- **Gemini API:** analyzes each alert and returns the verdict, confidence and explanation. See `server/index.js` and `server/prompt.js`.
- **Auth0:** login is required to run a check. Server guard is `requireLogin` in `server/index.js`; login UI is in `src/main.jsx` and `src/App.jsx`.
- **Tiger Data:** every AI check (verdict, confidence, red flags; not the alert text) is saved to a hypertable and charted with `time_bucket()`. See `server/db.js` and `src/TrendChart.jsx`.

