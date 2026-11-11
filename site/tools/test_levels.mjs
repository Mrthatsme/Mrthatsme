// Tests for permission levels (site/src/levels.js) and how the drafting agent obeys them.
// Real code on Node's SQLite; the AI model and email are stubbed.
//   node site/tools/test_levels.mjs
import { DatabaseSync } from "node:sqlite";
import { effectiveLevel, validateLevels, onNeverList } from "../src/levels.js";
import { ensureClientAgentTables, draftForClient } from "../src/clientagent.js";
import { saveLevels } from "../src/adminlevels.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

// ---- pure
check("defaults", effectiveLevel({}, "new_lead") === "Ask Me" && effectiveLevel({}, "emergency") === "Tell Me" && effectiveLevel({}, "not_customer") === "Handle It" && effectiveLevel({}, "complaint_or_legal") === "Never");
check("price question can't go above Ask Me, even if stored", effectiveLevel({ levels: { price_question: "Handle It" } }, "price_question") === "Ask Me");
check("complaints are always Never", effectiveLevel({ levels: { complaint_or_legal: "Ask Me" } }, "complaint_or_legal") === "Never");
check("an owner can lower a level", effectiveLevel({ levels: { emergency: "Ask Me" } }, "emergency") === "Ask Me");
check("dashboard refuses a level above the ceiling", validateLevels({ levels: { change_or_cancel: "Tell Me" } }).error === "above_ceiling");
check("dashboard refuses a bad sender", validateLevels({ neverFrom: ["not an email"] }).error === "bad_never_from");
check("Never list: exact address and whole domain", onNeverList({ neverFrom: ["lawyer@smithlaw.com", "@mybank.com"] }, "Pat Smith <Lawyer@SmithLaw.com>") && onNeverList({ neverFrom: ["@mybank.com"] }, "alerts@mybank.com") && !onNeverList({ neverFrom: ["@mybank.com"] }, "a@notmybank.com.evil"));

// ---- agent
const db = new DatabaseSync(":memory:");
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const s of l) await s.run(); } }, RESEND_API_KEY: "t", NOTIFY_EMAIL: "jerome@example.test", ANTHROPIC_API_KEY: "t" };
await ensureClientAgentTables(env);
const onCall = [{ name: "Sam", email: "sam@example.test", days: "daily", from: "00:00", to: "23:59" }];
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_1','QA','x',?,100,?)`)
  .run(JSON.stringify({ business: "QA Test Plumbing", emergencyTypes: "burst pipe", onCall, neverFrom: ["@mybank.com"] }), new Date().toISOString());
const agent = () => db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get();

let modelCalls = 0, reply = null;
const sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("anthropic")) { modelCalls++; return new Response(JSON.stringify({ content: [{ type: "tool_use", input: reply }] })); }
  if (String(url).includes("resend")) sent.push(JSON.parse(init.body));
  return new Response("{}");
};
const run = (input) => { reply = input; return draftForClient(env, agent(), { from: "Cust <c@example.test>", subject: "Hi", body: "..." }); };

let r = await run({ action: "draft", draft: "Thanks, the owner will follow up on pricing.", reason: "Price ask.", category: "price_question" });
check("price question stays a draft at Ask Me", r.action === "draft" && r.level === "Ask Me", r);

await saveLevels(env, { agentId: "ca_1", levels: { new_lead: "Handle It" }, neverFrom: ["@mybank.com"] });
r = await run({ action: "draft", draft: "Thanks for reaching out!", reason: "New lead.", category: "new_lead" });
check("Handle It on a reply still drafts, and says why", r.action === "draft" && r.level === "Handle It" && /approved replies/.test(r.levelNote), r);

await saveLevels(env, { agentId: "ca_1", levels: { customer_question: "Never" }, neverFrom: ["@mybank.com"] });
r = await run({ action: "draft", draft: "Sure!", reason: "Question.", category: "customer_question" });
check("Never: nothing written, left for the owner", r.action === "handoff" && !r.draft && /Never/.test(r.reason), r);

r = await run({ action: "handoff", reason: "Wants a refund.", category: "complaint_or_legal" });
check("complaints are left for the owner", r.action === "handoff" && r.level === "Never" && !r.draft, r);

const before = modelCalls;
r = await draftForClient(env, agent(), { from: "Alerts <alerts@mybank.com>", subject: "Statement", body: "secret" });
check("Never-list sender is not sent to the AI", modelCalls === before && r.action === "handoff" && r.level === "Never", { modelCalls, before, r });

sent.length = 0;
r = await run({ action: "handoff", reason: "Burst pipe.", category: "emergency", emergency: true, urgent: true, holding: "We got it.", emergency_brief: "Burst pipe at 1 Main" });
check("emergency at Tell Me goes to the on-call person", r.routedTo.includes("Sam") && sent.some((m) => m.to[0] === "sam@example.test") && r.actAllowed === true, { r, sent: sent.map((m) => m.to) });

await saveLevels(env, { agentId: "ca_1", levels: { emergency: "Ask Me" }, neverFrom: ["@mybank.com"] });
sent.length = 0;
r = await run({ action: "handoff", reason: "Burst pipe.", category: "emergency", emergency: true, urgent: true, holding: "We got it.", emergency_brief: "Burst pipe" });
check("emergency at Ask Me: owner alerted, nobody routed, no auto-reply", r.routedTo.length === 0 && r.actAllowed === false && !sent.some((m) => m.to[0] === "sam@example.test") && sent.some((m) => m.to[0] === "jerome@example.test"), { r, sent: sent.map((m) => m.to) });

r = await run({ action: "ignore", reason: "Newsletter.", category: "not_customer" });
check("newsletter at Handle It is set aside", r.action === "ignore" && r.level === "Handle It", r);
await saveLevels(env, { agentId: "ca_1", levels: { not_customer: "Ask Me" }, neverFrom: ["@mybank.com"] });
r = await run({ action: "ignore", reason: "Newsletter.", category: "not_customer" });
check("newsletter at Ask Me is flagged instead", r.action === "handoff", r);

r = await saveLevels(env, { agentId: "ca_1", levels: { price_question: "Handle It" } });
check("saving above a ceiling is refused", r.error === "above_ceiling" && /never quote a price/.test(r.message), r);

const log = db.prepare(`SELECT summary FROM client_agent_events WHERE agent_id = 'ca_1' ORDER BY id`).all().map((x) => x.summary);
check("the log shows the level on every decision", log.filter((l) => /^\[(Never|Ask Me|Tell Me|Handle It)\]/.test(l)).length === log.length, log);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
