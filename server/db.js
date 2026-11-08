// Tiger Data (TimescaleDB on Postgres): stores every AI check so we can chart trends.
// Saving is best-effort: if the database is missing or down, checks still work.
import pg from "pg";

const url = process.env.DATABASE_URL;
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url ?? "");

// The "sslmode" in the connection string would override our ssl setting below, so drop it
// and set encryption here instead.
function withoutSslMode(u) {
  const parsed = new URL(u);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

const pool = url
  ? new pg.Pool({
      connectionString: withoutSslMode(url),
      // Tiger Cloud requires an encrypted connection. Its certificate isn't in Node's default trust list,
      // so (like Tiger's own Node.js guide) we encrypt without verifying the certificate.
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 5000, // give up quickly instead of hanging a request
      query_timeout: 5000,
    })
  : null;

export const dbEnabled = Boolean(pool);
let ready = null;

// Create the table once. A hypertable is Tiger Data's time-series table: it splits rows by time
// so "what happened in the last few hours" queries stay fast as data grows.
function setup() {
  ready ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checks (
        time        TIMESTAMPTZ NOT NULL DEFAULT now(),
        user_id     TEXT,
        verdict     TEXT NOT NULL,
        confidence  REAL,
        red_flags   TEXT[],
        official_checked BOOLEAN
      )`);
    await pool.query(`SELECT create_hypertable('checks', by_range('time'), if_not_exists => TRUE)`);
  })().catch((err) => {
    ready = null; // try again next time
    throw err;
  });
  return ready;
}

// We store the verdict and red flags, not the alert text itself.
export async function saveCheck({ userId, verdict, confidence, redFlags, officialChecked }) {
  if (!pool) return;
  try {
    await setup();
    await pool.query(
      `INSERT INTO checks (user_id, verdict, confidence, red_flags, official_checked) VALUES ($1, $2, $3, $4, $5)`,
      [userId ?? null, verdict, confidence, redFlags, officialChecked]
    );
  } catch (err) {
    console.error("Tiger Data save failed:", err.message);
  }
}

// Counts per verdict in 15-minute buckets over the last 6 hours.
// time_bucket() is a TimescaleDB function that groups rows into fixed time slots.
export async function getStats() {
  await setup();
  const { rows } = await pool.query(`
    SELECT time_bucket('15 minutes', time) AS bucket,
           count(*) FILTER (WHERE verdict = 'suspicious')::int AS suspicious,
           count(*) FILTER (WHERE verdict = 'uncertain')::int  AS uncertain,
           count(*) FILTER (WHERE verdict = 'credible')::int   AS credible
    FROM checks
    WHERE time > now() - INTERVAL '6 hours'
    GROUP BY bucket
    ORDER BY bucket`);

  const { rows: flags } = await pool.query(`
    SELECT flag, count(*)::int AS n
    FROM checks, unnest(red_flags) AS flag
    WHERE time > now() - INTERVAL '6 hours'
    GROUP BY flag
    ORDER BY n DESC
    LIMIT 1`);

  return {
    bucketMinutes: 15,
    hours: 6,
    buckets: rows.map((r) => ({ ...r, bucket: new Date(r.bucket).toISOString() })),
    topFlag: flags[0] ?? null,
  };
}
