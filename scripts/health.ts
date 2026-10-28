// Rulare manuala: `npm run health`, cu `.env.health` local (rol Neon read-only + cheie PostHog query:read).
import { neon } from "@neondatabase/serverless";

import { type LoginSession, summarizeLogin } from "./health.lib";

const DAYS = 7;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Lipseste ${name} in .env.health`);
    process.exit(1);
  }
  return value;
}

const databaseUrl = requireEnv("HEALTH_DATABASE_URL");
const posthogKey = requireEnv("POSTHOG_PERSONAL_API_KEY");
const posthogEnvId = requireEnv("POSTHOG_ENV_ID");

const LOGIN_SESSIONS_QUERY = `
  SELECT
    any(properties.$geoip_country_code) AS country,
    countIf(properties.$pathname = '/login' AND properties.$current_url LIKE '%error=Verification%') AS fail_views,
    countIf(
      properties.$pathname NOT IN ('/', '/login', '/verify', '/verify-request', '/signup')
      AND NOT startsWith(properties.$pathname, '/api/')
    ) AS app_views
  FROM events
  WHERE event = '$pageview'
    AND timestamp >= now() - INTERVAL ${DAYS} DAY
    AND properties.$host IN ('detalia.ro', 'www.detalia.ro')
  GROUP BY $session_id
  HAVING countIf(properties.$pathname = '/verify') > 0
  LIMIT 10000
`;

async function loadLoginSessions(): Promise<LoginSession[]> {
  const res = await fetch(`https://eu.posthog.com/api/projects/${posthogEnvId}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${posthogKey}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: LOGIN_SESSIONS_QUERY }, name: "detalia health login" }),
  });
  if (!res.ok) throw new Error(`PostHog query: HTTP ${res.status}`);
  const { results } = (await res.json()) as { results: [string | null, number, number][] };
  return results.map(([country, failViews, appViews]) => ({ country, failViews, appViews }));
}

async function main() {
  const sql = neon(databaseUrl);
  const [login, sketchesByStatus, [lastPublished], [users]] = await Promise.all([
    loadLoginSessions(),
    sql`
      SELECT status, count(*)::int AS n FROM sketches
      WHERE is_annotation = false AND created_at >= now() - make_interval(days => ${DAYS})
      GROUP BY status ORDER BY status`,
    sql`SELECT max(updated_at) AS at FROM sketches WHERE status = 'PUBLISHED' AND is_annotation = false`,
    sql`
      SELECT
        count(*) FILTER (WHERE u.status = 'ACTIVE' AND r.id IS NULL)::int AS without_role,
        count(*) FILTER (WHERE u.created_at >= now() - make_interval(days => ${DAYS}))::int AS new_users
      FROM users u LEFT JOIN roles r ON r.user_id = u.id`,
  ]);

  const l = summarizeLogin(login);
  console.log(`DETALIA health — ultimele ${DAYS} zile`);
  console.log(
    `Login: ${l.ok} ok, ${l.recovered} reusit la reincercare, ${l.blocked} blocati, ` +
      `${l.noOutcome} fara rezultat (${l.scanners} scanere de email excluse)`,
  );
  console.log(`Schite create: ${sketchesByStatus.map((r) => `${r.status} ${r.n}`).join(", ") || "niciuna"}`);
  console.log(`Ultima schita publicata (updated_at): ${lastPublished.at ? new Date(lastPublished.at).toISOString() : "niciuna"}`);
  console.log(`Useri noi: ${users.new_users}; useri activi fara rol: ${users.without_role}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
