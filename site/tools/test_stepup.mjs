// Tests for the step-up rule (Haiku drafts, Sonnet takes a second look at a few)
// and per-client token logging. Real code on Node's SQLite; the AI model is stubbed.
//   node site/tools/test_stepup.mjs
import { DatabaseSync } from "node:sqlite";
import { ensureClientAgentTables, draftForClient, stepUpReason, tokenCostReport, recordTokens, aiCostLine,
  STEP_UP_MODEL, STEP_UP_DAILY_CAP } from "../src/clientagent.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

// ---- the rule, pure
const on = { stepUp: true };
const draft = (extra = {}) => ({ action: "draft", draft: "Hi Sam, thanks.", category: "new_lead", level: "Ask Me", ...extra });
const long = "x".repeat(2600);
check("off by default: no step-up without stepUp: true", stepUpReason({}, draft(), long) === null);
check("long thread steps up", stepUpReason(on, draft(), long) === "long thread");
check("two [GAP]s step up", stepUpReason(on, draft({ draft: "Hi, [GAP] and [GAP]." }), "short") === "several blanks");
check("one [GAP] does not", stepUpReason(on, draft({ draft: "Hi, [GAP]." }), "short") === null);
check("repeat customer question steps up",
  stepUpReason(on, draft({ category: "customer_question" }), "Thanks!\n\nOn Mon, Nov 10, 2026 at 9:00 AM Bob <b@x.test> wrote:\n> earlier") === "repeat customer");
check("a new lead with history does not step up on that alone",
  stepUpReason(on, draft({ category: "new_lead" }), "Hi\n> quoted") === null);
check("short, clean, first-time email stays on Haiku", stepUpReason(on, draft(), "Do you fix water heaters?") === null);
check("hand-offs never step up", stepUpReason(on, draft({ action: "handoff", draft: undefined }), long) === null);
check("urgent never steps up", stepUpReason(on, draft({ urgent: true }), long) === null);
check("emergencies never step up", stepUpReason(on, draft({ emergency: true }), long) === null);
check("Never level never steps up", stepUpReason(on, draft({ level: "Never" }), long) === null);
check("ignored mail never steps up", stepUpReason(on, draft({ action: "ignore" }), long) === null);

// ---- the agent, with a stubbed model
const db = new DatabaseSync(":memory:");
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const s of l) await s.run(); } },
  RESEND_API_KEY: "t", NOTIFY_EMAIL: "jerome@example.test", ANTHROPIC_API_KEY: "t" };
await ensureClientAgentTables(env);
const setProfile = (p) => db.prepare(`UPDATE client_agents SET profile = ? WHERE id = 'ca_1'`).run(JSON.stringify(p));
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_1','QA','x','{}',100,?)`)
  .run(new Date().toISOString());
const agent = () => db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get();
setProfile({ business: "QA Test Plumbing", stepUp: true });

let haikuReply, sonnet = { mode: "ok" };
const calls = [];
globalThis.fetch = async (url, init) => {
  if (!String(url).includes("anthropic")) return new Response("{}");
  const body = JSON.parse(init.body);
  calls.push(body);
  if (body.model === STEP_UP_MODEL) {
    if (sonnet.mode === "error") return new Response("{}", { status: 529 });
    if (sonnet.mode === "refusal") return new Response(JSON.stringify({ stop_reason: "refusal", content: [], usage: { input_tokens: 900, output_tokens: 0 } }));
    const out = sonnet.mode === "handoff"
      ? { draft: "", handoff: true, reason: "Customer is upset about the last visit." }
      : { draft: "Hi Sam, thanks for following up. [GAP] for the visit time.", handoff: false, reason: "Follow-up question." };
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(out) }],
      usage: { input_tokens: 1800, output_tokens: 700 } }));
  }
  return new Response(JSON.stringify({ content: [{ type: "tool_use", input: haikuReply }], usage: { input_tokens: 1500, output_tokens: 200 } }));
};
const run = (reply, body = long) => { haikuReply = reply; calls.length = 0; return draftForClient(env, agent(), { from: "Sam <sam@example.test>", subject: "Re: visit", body }); };
const sonnetCalls = () => calls.filter((c) => c.model === STEP_UP_MODEL);

let r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Follow-up.", category: "new_lead" });
check("long thread: Sonnet rewrites the draft", r.steppedUp === "long thread" && /following up/.test(r.draft) && sonnetCalls().length === 1, r);
check("the owner can see it was a second look", /Second look: long thread/.test(r.reason), r.reason);
const sc = sonnetCalls()[0];
check("Sonnet call uses structured output, not forced tool choice", sc.output_config?.format?.type === "json_schema" && !sc.tool_choice && !sc.tools, sc);
check("Sonnet gets the same rules as Haiku", /Never quote a price/.test(sc.system) && /SECOND PASS/.test(sc.system), sc.system.slice(0, 80));
check("the first draft is passed as data", /<first_draft>\nHi Sam, thanks\.\n<\/first_draft>/.test(sc.messages[0].content), sc.messages[0].content.slice(-80));

r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Question.", category: "new_lead" }, "Do you fix water heaters?");
check("short first-time email: Haiku only, no Sonnet call", !r.steppedUp && sonnetCalls().length === 0, r);

r = await run({ action: "handoff", reason: "Refund.", category: "complaint_or_legal" });
check("hand-off: no Sonnet call", r.action === "handoff" && sonnetCalls().length === 0, r);

sonnet.mode = "handoff";
r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Follow-up.", category: "new_lead" });
check("Sonnet can make it more cautious: hand off, no draft", r.action === "handoff" && !r.draft && /better left for you/.test(r.reason), r);

sonnet.mode = "error";
r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Follow-up.", category: "new_lead" });
check("Sonnet down: Haiku's draft is kept", r.action === "draft" && r.draft === "Hi Sam, thanks." && !r.steppedUp, r);

sonnet.mode = "refusal";
r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Follow-up.", category: "new_lead" });
check("Sonnet declines: Haiku's draft is kept", r.action === "draft" && r.draft === "Hi Sam, thanks." && !r.steppedUp, r);

// So far today: ok + handoff + refusal reached Sonnet and were logged (the 529 error was not billed or logged).
sonnet.mode = "ok";
let made = 0;
for (let i = 0; i < 10; i++) {
  r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Follow-up.", category: "new_lead" });
  if (r.steppedUp) made++;
}
const today = new Date().toISOString().slice(0, 10);
const sonnetRow = db.prepare(`SELECT calls FROM client_agent_tokens WHERE agent_id='ca_1' AND usage_date=? AND model=?`).get(today, STEP_UP_MODEL);
check(`daily step-up cap holds at ${STEP_UP_DAILY_CAP}`, sonnetRow.calls === STEP_UP_DAILY_CAP && made === STEP_UP_DAILY_CAP - 3, { sonnetRow, made });
check("over the cap, the Haiku draft still goes through", r.action === "draft" && r.draft === "Hi Sam, thanks.", r);

setProfile({ business: "QA Test Plumbing" });
db.prepare(`DELETE FROM client_agent_tokens`).run();
r = await run({ action: "draft", draft: "Hi Sam, thanks.", reason: "Follow-up.", category: "new_lead" });
check("client without stepUp: never calls Sonnet", sonnetCalls().length === 0 && !r.steppedUp, r);

// ---- token logging and the cost report
const haikuRow = db.prepare(`SELECT * FROM client_agent_tokens WHERE agent_id='ca_1' AND model='claude-haiku-5-5'`).get();
check("Haiku tokens logged per client per day", haikuRow && haikuRow.calls === 1 && haikuRow.input_tokens === 1500 && haikuRow.output_tokens === 200, haikuRow);
await recordTokens(env, "ca_1", STEP_UP_MODEL, { input_tokens: 1800, output_tokens: 700, cache_read_input_tokens: 100 });
await recordTokens(env, "ca_1", "claude-haiku-5-5", undefined);
const rep = await tokenCostReport(env, "ca_1", today, today);
const haiku = rep.models.find((m) => m.model === "claude-haiku-5-5"), son = rep.models.find((m) => m.model === STEP_UP_MODEL);
check("missing usage still counts the call, adds no tokens", haiku.calls === 2 && haiku.input_tokens === 1500, haiku);
check("cost report: Haiku $0.00025", haiku.usd === 0.00025, haiku);
check("cost report: Sonnet $0.01061", son.usd === 0.01061, son);
check("cost report total", rep.usd === 0.01086, rep);
const line = await aiCostLine(env, "ca_1");
check("brief line shows month-to-date cost", line === "  AI cost this month: $0.01 at list prices (2 Haiku call(s), 1 second look(s) on Sonnet).", line);
check("no usage, no brief line", (await aiCostLine(env, "ca_nobody")) === null);
const broken = { DB: { prepare: () => { throw new Error("db down"); } } };
await recordTokens(broken, "ca_1", "claude-haiku-5-5", { input_tokens: 1 });
check("token logging never throws", true);

// ---- the dashboard switch
const { saveLevels, dashboardLevels, renderLevelsPanel } = await import("../src/adminlevels.js");
let s = await saveLevels(env, { agentId: "ca_1", levels: {}, neverFrom: [], stepUp: true });
check("dashboard turns the second look on", s.ok && s.stepUp === true && JSON.parse(agent().profile).stepUp === true, s);
s = await saveLevels(env, { agentId: "ca_1", levels: {}, neverFrom: [] });
check("saving without the field leaves it as it was", s.stepUp === true, s);
s = await saveLevels(env, { agentId: "ca_1", levels: {}, neverFrom: [], stepUp: false });
check("dashboard turns it off", s.stepUp === false && JSON.parse(agent().profile).stepUp === false, s);
await saveLevels(env, { agentId: "ca_1", levels: {}, neverFrom: [], stepUp: true });
const html = renderLevelsPanel(await dashboardLevels(env), "n");
check("card shows the checkbox, ticked when on", /name="stepUp" checked/.test(html) && /stepUp: f\.stepUp\.checked/.test(html), html.length);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
