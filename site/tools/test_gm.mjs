// Tests for the GM (site/src/gm.js) and how the drafting agent asks it for help.
// Runs on Node's built-in SQLite in place of D1; the AI model and email are stubbed.
//   node site/tools/test_gm.mjs
import { DatabaseSync } from "node:sqlite";
import { words, overlap, parseApproved, answerAllowed, askGM, saveAnswer, dismissGap, openGaps, gmLines } from "../src/gm.js";
import { ensureClientAgentTables, draftForClient } from "../src/clientagent.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

// ---- pure
check("words drop filler and plurals", words("Do you service the Chesapeake areas?").join(" ") === "service chesapeake area", words("Do you service the Chesapeake areas?"));
check("overlap matches rephrasing", overlap("Do you cover Chesapeake?", "Do you service or cover Chesapeake?") === 1);
check("overlap rejects a different question", overlap("Are you licensed?", "Do you service Chesapeake?") === 0);
check("approved answers parse", parseApproved("Q: Are you licensed? A: Yes, licensed and insured.\nOpen Saturdays? No.").length === 2);
check("prices refused", !answerAllowed("A tune-up is $89") && !answerAllowed("about 120 dollars") && answerAllowed("Yes, we cover Chesapeake."));

// ---- D1 stand-in
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
const profile = { business: "QA Test Co", trade: "plumbing", area: "Norfolk", approvedAnswers: "Q: Are you licensed? A: Yes, licensed and insured in Virginia." };
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_1', 'QA Test Co', 'x', ?, 30, ?)`)
  .run(JSON.stringify(profile), new Date().toISOString());
const agent = db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get();

let r = await askGM(env, agent, { from: "Intake", query: "Are you licensed and insured?" });
check("GM answers from the client's approved answers", /licensed and insured/.test(r.answer || ""), r);
r = await askGM(env, agent, { from: "Intake", query: "Do you service Chesapeake?" });
check("unknown question: no answer", r.answer === null, r);
await askGM(env, agent, { from: "Quotes", query: "Do you service Chesapeake?" });
let gaps = await openGaps(env, "ca_1");
check("repeat question counted once, twice asked", gaps.length === 1 && gaps[0].times === 2, gaps);
r = await askGM(env, agent, { skill: "service_area" });
check("service area skill", r.answer === "Service area: Norfolk.", r);
r = await askGM(env, agent, { skill: "nope" });
check("unknown skill refused", r.error === "unknown_skill", r);

r = await saveAnswer(env, { agentId: "ca_1", gapId: gaps[0].id, answer: "Yes, a trip to Chesapeake is $50" });
check("GM refuses to store a price", r.error === "no_prices", r);
r = await saveAnswer(env, { agentId: "ca_1", gapId: gaps[0].id, answer: "Yes, we cover Chesapeake and Virginia Beach." });
check("answer saved, gap closed", r.ok && r.closedGaps === 1 && (await openGaps(env, "ca_1")).length === 0, r);
r = await askGM(env, agent, { from: "Intake", query: "do you cover chesapeake" });
check("learned answer handed to any agent", /Chesapeake and Virginia Beach/.test(r.answer || "") && r.from === "learned", r);

r = await askGM(env, agent, { from: "Intake", query: "Do you service Norfolk?" });
check("a different town doesn't get Chesapeake's answer", r.answer === null, r);
r = await askGM(env, agent, { from: "Intake", query: "Do you work Sundays?" });
check("an unrelated question gets nothing", r.answer === null, r);

// ---- drafting agent asks the GM, then redrafts once
const calls = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (String(url).includes("anthropic")) {
    calls.push(body.system);
    const fromGM = /from the GM/.test(body.system);
    const input = fromGM
      ? { action: "draft", draft: "Hi Sam, yes, we cover Chesapeake. [GAP] for timing.", reason: "Service-area question.", gaps: [] }
      : { action: "draft", draft: "Hi Sam, [GAP]", reason: "Service-area question.", gaps: ["Do you service Chesapeake?", "Do you fix tankless heaters?"] };
    return new Response(JSON.stringify({ content: [{ type: "tool_use", input }] }));
  }
  return new Response("{}");
};
r = await draftForClient(env, agent, { from: "Sam <sam@example.test>", subject: "Question", body: "Do you come out to Chesapeake? And do you fix tankless heaters?" });
check("drafter asked the GM and redrafted with its answer", calls.length === 2 && /Chesapeake and Virginia Beach/.test(calls[1]) && r.gmAnswered === 1 && /we cover Chesapeake/.test(r.draft), { calls: calls.length, r });
gaps = await openGaps(env, "ca_1");
check("what the GM didn't know became a gap", gaps.some((g) => /tankless/.test(g.question) && g.asked_by === "Intake") && !gaps.some((g) => /chesapeake/i.test(g.question)), gaps);

calls.length = 0;
globalThis.fetch = async (url) => { calls.push(1); return new Response(JSON.stringify({ content: [{ type: "tool_use", input: { action: "draft", draft: "Hi", reason: "x", gaps: ["Do you do pool heaters?"] } }] })); };
await draftForClient(env, agent, { from: "a@example.test", subject: "q", body: "pool heaters?" });
check("no redraft when the GM has nothing", calls.length === 1, calls.length);

r = await dismissGap(env, { agentId: "ca_1", gapId: (await openGaps(env, "ca_1")).find((g) => /pool/.test(g.question)).id });
check("gap can be dismissed", r.ok, r);

const lines = await gmLines(env, [agent]);
check("brief has a GM section with the open question", lines[0] === "THE GM" && lines.some((l) => /tankless/.test(l)), lines);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
