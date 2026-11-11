// Tests for the GM's watch (site/src/gmwatch.js). Real code on Node's SQLite with
// the real migrations; email is captured, not sent.
//   node site/tools/test_gmwatch.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { gmWatch, watchHealth, weeklyHours, currentProblems } from "../src/gmwatch.js";
import { ensureClientAgentTables } from "../src/clientagent.js";
import { ensureHoursTables } from "../src/hours.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

check("weekly hours from 30 days", weeklyHours(15 * 60 * 30 / 7) === 15 && weeklyHours(0) === 0, weeklyHours(15 * 60 * 30 / 7));

const db = new DatabaseSync(":memory:");
const dir = new URL("../migrations/", import.meta.url);
for (const f of fs.readdirSync(dir).sort()) db.exec(fs.readFileSync(new URL(f, dir), "utf8"));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const s of l) await s.run(); } }, RESEND_API_KEY: "t", NOTIFY_EMAIL: "jerome@example.test" };
const sent = [];
globalThis.fetch = async (url, init) => { if (String(url).includes("resend")) sent.push(JSON.parse(init.body)); return new Response("{}"); };
await ensureClientAgentTables(env);
await ensureHoursTables(env);
db.exec(`CREATE TABLE IF NOT EXISTS client_connections (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, provider TEXT NOT NULL, email TEXT,
  enc_refresh_token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', connected_at TEXT NOT NULL, last_poll TEXT, scopes TEXT)`);

const now = new Date("2026-11-11T20:00:00Z");
const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
const agent = (id, label, lastSeenMinAgo) => db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, last_seen, created_at) VALUES (?, ?, 'x', '{}', 30, ?, ?)`)
  .run(id, label, lastSeenMinAgo == null ? null : iso(lastSeenMinAgo), iso(10000));

// Healthy to start.
agent("ca_ok", "Good Co", 5);
db.prepare(`INSERT INTO client_connections (id, agent_id, provider, email, enc_refresh_token, status, connected_at, last_poll) VALUES ('c1','ca_ok','google','ok@x.test','t','active',?,?)`).run(iso(5000), iso(8));
let r = await gmWatch(env, now);
check("all healthy: nothing open, no email", r.open === 0 && sent.length === 0, { r, sent: sent.length });
check("health OK right after a run", (await watchHealth(env, now)).ok === true);
check("health fails if the watch stops", (await watchHealth(env, new Date(now.getTime() + 45 * 60000))).ok === false);

// Problems appear.
db.prepare(`UPDATE client_connections SET last_poll = ? WHERE id = 'c1'`).run(iso(55));
agent("ca_dis", "Gone Co", 5);
db.prepare(`INSERT INTO client_connections (id, agent_id, provider, email, enc_refresh_token, status, connected_at) VALUES ('c2','ca_dis','google','gone@x.test','t','disconnected',?)`).run(iso(5000));
agent("ca_quiet", "Script Co", 300);
db.prepare(`INSERT INTO agent_heartbeats (agent, last_seen, detail) VALUES ('inbox', ?, '')`).run(iso(400));
db.prepare(`INSERT INTO leads (id, name, business, contact, status, created_at) VALUES ('l1','Pat','Pat Co','p@x.test','new',?)`).run(iso(45));
db.prepare(`INSERT INTO leads (id, name, business, contact, status, created_at) VALUES ('l2','QA Test','QA','q@x.test','test',?)`).run(iso(45));
r = await gmWatch(env, now);
const keys = (await currentProblems(env, now)).map((p) => p.key).sort();
check("finds polling stopped, disconnected, quiet agent, stopped script, stuck inquiry", JSON.stringify(keys) === JSON.stringify(["disconnected:ca_dis", "polling:c1", "quiet:ca_quiet", "script:inbox", "triage:stuck"]), keys);
check("test inquiries don't count", /1 website inquiry/.test(sent.at(-1).text), sent.at(-1) && sent.at(-1).text);
check("one email listing all five", sent.length === 1 && /5 new problems/.test(sent[0].subject), sent.map((m) => m.subject));

// Nothing changed: no repeat.
r = await gmWatch(env, new Date(now.getTime() + 10 * 60000));
check("no repeat email while nothing changes", sent.length === 1 && r.fresh === 0, { r, n: sent.length });

// One clears.
db.prepare(`UPDATE client_connections SET last_poll = ? WHERE id = 'c1'`).run(new Date(now.getTime() + 15 * 60000).toISOString());
r = await gmWatch(env, new Date(now.getTime() + 20 * 60000));
check("cleared problem gets a back-to-normal email", sent.length === 2 && /BACK TO NORMAL \(1\)/.test(sent[1].text) && /ok@x\.test/.test(sent[1].text), sent[1] && sent[1].text);

// Capacity: 13 hrs/week logged over 30 days, then 16.
const logMinutes = (m) => db.prepare(`INSERT INTO hours_log (agent_id, month, work_date, minutes, task, kind, logged_at) VALUES ('ca_ok','2026-11','2026-11-10',?, 'work','admin',?)`).run(m, iso(60));
logMinutes(Math.round(13 * 60 * 30 / 7));
let p = (await currentProblems(env, now)).map((x) => x.key);
check("heads-up near the trigger", p.includes("capacity:near") && !p.includes("capacity:trigger"), p);
logMinutes(Math.round(3 * 60 * 30 / 7));
p = (await currentProblems(env, now)).map((x) => x.key);
check("restructure trigger at 15 a week", p.includes("capacity:trigger") && !p.includes("capacity:near"), p);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
