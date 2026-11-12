// Tests for the owner's one-tap yes/no links (links.js, approvals.js) and the
// yes/no list in the Daily Brief. Real code on Node's SQLite; email is captured.
//   node site/tools/test_approvals.mjs
import { DatabaseSync } from "node:sqlite";
import { makeLink, readLink } from "../src/links.js";
import { linkPage, linkAct } from "../src/approvals.js";
import { createBuild, statusFor } from "../src/hours.js";
import { ensureClientAgentTables, logClientAgentEvent } from "../src/clientagent.js";
import { buildBriefFor } from "../src/clientbrief.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

const db = new DatabaseSync(":memory:");
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const s of l) await s.run(); } },
  RESEND_API_KEY: "t", NOTIFY_EMAIL: "jerome@example.test", TOKEN_ENC_KEY: "k".repeat(40) };
const sent = [];
globalThis.fetch = async (url, init) => { if (String(url).includes("resend")) sent.push(JSON.parse(init.body)); return new Response("{}"); };

// ---- links
const now = new Date();
const link = await makeLink(env, { t: "done", id: 1, ag: "ca_1" }, now);
const tok = link.split("/b/")[1];
check("link reads back", (await readLink(env, tok, now)).id === 1);
// Change a character in the middle of the signature: the last base64url character
// carries spare bits, so changing it can leave the decoded signature the same.
const flip = (t) => { const i = t.indexOf(".") + 10; return t.slice(0, i) + (t[i] === "A" ? "B" : "A") + t.slice(i + 1); };
check("tampered link is refused", (await readLink(env, flip(tok), now)) === null);
check("expired link is refused", (await readLink(env, tok, new Date(now.getTime() + 15 * 86400000))) === null);
check("a different key can't read it", (await readLink({ TOKEN_ENC_KEY: "z".repeat(40) }, tok, now)) === null);

// ---- setup: a Business Support client with a build heading past its hours
await ensureClientAgentTables(env);
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_1','QA','x',?,30,?)`)
  .run(JSON.stringify({ business: "QA Test Plumbing", plan: "business_support", ownerEmail: "owner@example.test" }), new Date(now.getTime() - 86400000).toISOString());
db.exec(`CREATE TABLE IF NOT EXISTS client_connections (id TEXT PRIMARY KEY, agent_id TEXT, provider TEXT, email TEXT, enc_refresh_token TEXT, status TEXT, connected_at TEXT, last_poll TEXT, scopes TEXT)`);
await createBuild(env, { agentId: "ca_1", name: "Warranty reminders", estimateMinutes: 600, includedCustom: true }, now);
const warn = sent.find((m) => m.to[0] === "owner@example.test" && /heading past/.test(m.subject));
const yesUrl = (warn.text.match(/Yes, OK[^\n]*\n\s+(\S+)/) || [])[1];
const noUrl = (warn.text.match(/No, pause[^\n]*\n\s+(\S+)/) || [])[1];
check("warning email carries Yes and No links", /\/b\//.test(yesUrl || "") && /\/b\//.test(noUrl || ""), warn.text);

// ---- the brief lists the yes/no
const brief = await buildBriefFor(env, db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get(), now);
check("brief has a yes/no section", /NEEDS YOUR YES OR NO \(1\)/.test(brief.text) && /Yes: https:\/\/minutesregained\.com\/b\//.test(brief.text) && /1 yes or no/.test(brief.subject), brief.text);

// ---- opening a link changes nothing
const req = { headers: new Map([["CF-Connecting-IP", "203.0.113.9"]]) };
req.headers.get = req.headers.get.bind(req.headers);
const tokOf = (u) => u.split("/b/")[1];
let res = await linkPage(env, tokOf(yesUrl));
let html = await res.text();
check("opening the link only asks", res.status === 200 && /Approve up to 2 hr of extra time to finish Warranty reminders, at \$95 an hour \(about \$190\.00\)/.test(html) && /<form method="post">/.test(html), html.slice(0, 600));
check("nothing approved yet", (await statusFor(env, db.prepare(`SELECT * FROM client_agents WHERE id='ca_1'`).get())).approved === 0);

// ---- pressing Yes records the approval
sent.length = 0;
res = await linkAct(env, tokOf(yesUrl), req);
html = await res.text();
const st = await statusFor(env, db.prepare(`SELECT * FROM client_agents WHERE id='ca_1'`).get());
const appr = db.prepare(`SELECT note FROM hours_approvals WHERE agent_id='ca_1'`).get();
check("Yes records the extra time", /Approved/.test(html) && st.approved === 120 && /one-tap link/.test(appr.note) && /203\.0\.113\.9/.test(appr.note), { st, appr });
check("Jerome is told", sent.some((m) => m.to[0] === "jerome@example.test" && /approved 2 hr extra/.test(m.subject)), sent.map((m) => m.subject));
res = await linkAct(env, tokOf(yesUrl), req);
check("pressing again does nothing", /Already answered/.test(await res.text()) && db.prepare(`SELECT COUNT(*) AS n FROM hours_approvals`).get().n === 1);
res = await linkAct(env, tokOf(noUrl), req);
check("the No link is dead once answered", /Already answered/.test(await res.text()));

// ---- a declined request
db.prepare(`INSERT INTO hours_requests (agent_id, build_id, month, minutes, created_at) VALUES ('ca_1', NULL, ?, 60, ?)`).run(now.toISOString().slice(0, 7), now.toISOString());
const rid = db.prepare(`SELECT MAX(id) AS id FROM hours_requests`).get().id;
const noLink = await makeLink(env, { t: "hours", id: rid, a: "no", ag: "ca_1" });
res = await linkAct(env, tokOf(noLink), req);
check("No declines it", /paused/.test(await res.text()) && db.prepare(`SELECT status FROM hours_requests WHERE id = ?`).get(rid).status === "declined");

// ---- last month's request can't be approved now
db.prepare(`INSERT INTO hours_requests (agent_id, build_id, month, minutes, created_at) VALUES ('ca_1', NULL, '2000-01', 60, ?)`).run(now.toISOString());
const oldId = db.prepare(`SELECT MAX(id) AS id FROM hours_requests`).get().id;
res = await linkAct(env, tokOf(await makeLink(env, { t: "hours", id: oldId, a: "yes", ag: "ca_1" })), req);
check("last month's request expires instead", /for last month/.test(await res.text()) && db.prepare(`SELECT status FROM hours_requests WHERE id = ?`).get(oldId).status === "expired");

// ---- Done links clear the waiting list
await logClientAgentEvent(env, "ca_1", "needs_you", `[Ask Me] URGENT "Reschedule" from a@b.c: wants Friday.`);
let b2 = await buildBriefFor(env, db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get(), now);
const doneUrl = (b2.text.match(/Done\? (\S+)/) || [])[1];
check("waiting item has a Done link, level tag hidden", /URGENT "Reschedule"/.test(b2.text) && !/\[Ask Me\]/.test(b2.text) && /\/b\//.test(doneUrl || ""), b2.text);
await linkAct(env, tokOf(doneUrl), req);
b2 = await buildBriefFor(env, db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get(), now);
check("marked done, gone from the brief", !/Reschedule/.test(b2.text) && /WAITING ON YOU \(0\)/.test(b2.text), b2.text);

// ---- someone else's link can't touch this client
const wrong = await makeLink(env, { t: "done", id: 1, ag: "ca_other" });
res = await linkPage(env, tokOf(wrong));
check("a link for another client is refused", res.status === 410);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
