// Tests for "Pause everything" (site/src/pause.js and the places that obey it).
// Real code on Node's SQLite with the real migrations; AI, Google and email are stubbed.
//   node site/tools/test_pause.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { linkPage, linkAct } from "../src/approvals.js";
import { buildBriefFor } from "../src/clientbrief.js";
import { handleIntake } from "../src/clientpages.js";
import { pollConnectedInboxes, _storeConnectionForTest } from "../src/connect.js";
import { ensureClientAgentTables } from "../src/clientagent.js";
import { currentProblems } from "../src/gmwatch.js";
import { contractText } from "../src/contract.js";
import { resolvePlan } from "../src/plans.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

const db = new DatabaseSync(":memory:");
const dir = new URL("../migrations/", import.meta.url);
for (const f of fs.readdirSync(dir).sort()) db.exec(fs.readFileSync(new URL(f, dir), "utf8"));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const s of l) await s.run(); } },
  RESEND_API_KEY: "t", NOTIFY_EMAIL: "jerome@example.test", TOKEN_ENC_KEY: "k".repeat(40), ANTHROPIC_API_KEY: "t",
  GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "g" };
const sent = []; let modelCalls = 0, googleCalls = 0;
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.includes("resend")) { sent.push(JSON.parse(init.body)); return new Response("{}"); }
  if (url.includes("anthropic")) { modelCalls++; return new Response(JSON.stringify({ content: [{ type: "tool_use", input: { action: "draft", draft: "Hi", reason: "x", category: "new_lead" } }] })); }
  if (url.includes("google")) { googleCalls++; return new Response(JSON.stringify({ access_token: "a", messages: [] })); }
  return new Response("{}");
};

await ensureClientAgentTables(env);
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, last_seen, created_at) VALUES ('ca_1','QA','x',?,30,NULL,?)`)
  .run(JSON.stringify({ business: "QA Test Plumbing", ownerEmail: "owner@example.test", formSlug: "qa-test-co" }), new Date(Date.now() - 86400000).toISOString());
await _storeConnectionForTest(env, { id: "con_1", agentId: "ca_1", provider: "google", email: "owner@example.test", refreshToken: "rt", scopes: "openid email https://www.googleapis.com/auth/gmail.modify" });
const agent = () => db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get();
const tokOf = (u) => u.split("/b/")[1];
const req = { headers: { get: (k) => (k === "CF-Connecting-IP" ? "203.0.113.5" : null) } };

// ---- the brief always offers the pause
let b = await buildBriefFor(env, agent());
const pauseUrl = (b.text.match(/Pause everything: (\S+)/) || [])[1];
check("brief offers 'Pause everything'", /\/b\//.test(pauseUrl || ""), b.text);

// ---- opening the link asks; pressing pauses
let res = await linkPage(env, tokOf(pauseUrl));
let html = await res.text();
check("the confirmation says fees and notice don't change", /Pause everything for QA Test Plumbing\?/.test(html) && /fee and 30-day notice don(&#39;|')t change/.test(html) && !JSON.parse(agent().profile).pausedAt, html.slice(0, 500));
sent.length = 0;
res = await linkAct(env, tokOf(pauseUrl), req);
check("pressing pauses, and Jerome is told", /Everything is paused/.test(await res.text()) && !!JSON.parse(agent().profile).pausedAt && sent.some((m) => /PAUSED everything/.test(m.subject)), sent.map((m) => m.subject));
res = await linkAct(env, tokOf(pauseUrl), req);
check("pressing again changes nothing", /Already paused/.test(await res.text()));

// ---- while paused
googleCalls = 0;
await pollConnectedInboxes(env);
check("the inbox isn't read", googleCalls === 0, googleCalls);

sent.length = 0; modelCalls = 0;
const waits = [];
const formReq = new Request("https://minutesregained.com/api/intake/qa-test-co", { method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.7" },
  body: JSON.stringify({ name: "Dana", email: "dana@example.test", message: "Leaking heater", elapsed_ms: 9000 }) });
res = await handleIntake(formReq, env, "qa-test-co", { waitUntil: (p) => waits.push(p) });
await Promise.all(waits);
check("form request still recorded", res.status === 200 && db.prepare(`SELECT COUNT(*) AS n FROM client_leads WHERE agent_id = 'ca_1'`).get().n === 1);
check("no AI draft and no acknowledgement to the customer", modelCalls === 0 && !sent.some((m) => m.to[0] === "dana@example.test"), { modelCalls, to: sent.map((m) => m.to[0]) });
check("the owner gets it unprocessed", sent.some((m) => m.to[0] === "owner@example.test" && /\(paused\)/.test(m.subject) && /wasn't processed/.test(m.text)), sent.map((m) => m.subject));

db.prepare(`UPDATE client_connections SET last_poll = ? WHERE id = 'con_1'`).run(new Date(Date.now() - 120 * 60000).toISOString());
check("the watch doesn't raise an alarm about a paused inbox", !(await currentProblems(env)).some((p) => p.key.startsWith("polling:")), await currentProblems(env));

b = await buildBriefFor(env, agent());
const resumeUrl = (b.text.match(/Resume: (\S+)/) || [])[1];
check("the brief says PAUSED with a Resume link", /^PAUSED\. Your Daily Brief/.test(b.subject) && /EVERYTHING IS PAUSED/.test(b.text) && /\/b\//.test(resumeUrl || "") && !/Pause everything:/.test(b.text) && b.hasContent, b.text);

// ---- resume
res = await linkAct(env, tokOf(resumeUrl), req);
check("Resume turns it back on", /Resumed/.test(await res.text()) && !JSON.parse(agent().profile).pausedAt);
googleCalls = 0;
await pollConnectedInboxes(env);
check("the inbox is read again", googleCalls > 0, googleCalls);

// ---- the agreement says it
const t = contractText({ businessName: "X", plan: resolvePlan("business_support", false, "monthly"), foundingOffer: false });
check("agreement: pause doesn't change fee or notice", /pause everything at any time/.test(t) && /does not change the fee or the notice\s+period/.test(t), t.slice(t.indexOf("2. Scope"), t.indexOf("3. No financial")));

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
