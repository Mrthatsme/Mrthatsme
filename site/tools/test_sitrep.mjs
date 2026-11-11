// Tests for the weekly SITREP (site/src/sitrep.js). Real code on Node's SQLite;
// the AI model and email are stubbed.
//   node site/tools/test_sitrep.mjs
import { DatabaseSync } from "node:sqlite";
import { lastWeek, isSitrepTime, minutesTable, timeBack, narrativeProblem, composeSitrep, factsForModel,
  gatherFacts, sendSitreps, DEFAULT_MINUTES } from "../src/sitrep.js";
import { ensureClientAgentTables, STEP_UP_MODEL } from "../src/clientagent.js";
import { ensureGmTables } from "../src/gm.js";
import { ensureDoneTable } from "../src/approvals.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

// ---- the calendar
const NY = "America/New_York", LA = "America/Los_Angeles";
const mon7 = new Date("2026-11-16T12:00:00Z");           // Monday 7:00 AM Eastern
let w = lastWeek(NY, mon7);
check("last week is Monday to Sunday", w.weekStart === "2026-11-09" && w.weekEnd === "2026-11-15" && w.label === "Nov 9 to Nov 15", w);
check("week starts and ends at local midnight", w.start === "2026-11-09T05:00:00.000Z" && w.end === "2026-11-16T05:00:00.000Z" && w.prevStart === "2026-11-02T05:00:00.000Z", w);
w = lastWeek(NY, new Date("2026-11-18T20:00:00Z"));
check("same week when asked midweek", w.weekStart === "2026-11-09", w);
w = lastWeek(NY, new Date("2026-11-02T13:00:00Z"));
check("week across the clock change keeps local midnights", w.start === "2026-10-26T04:00:00.000Z" && w.end === "2026-11-02T05:00:00.000Z", w);
check("Monday 6:59 AM: not yet", !isSitrepTime(NY, new Date("2026-11-16T11:59:00Z")));
check("Monday 7:00 AM: time", isSitrepTime(NY, mon7));
check("Pacific owner waits for their own 7 AM", !isSitrepTime(LA, mon7) && isSitrepTime(LA, new Date("2026-11-16T15:00:00Z")));
check("Tuesday: no", !isSitrepTime(NY, new Date("2026-11-17T12:00:00Z")));
check("Sunday night Eastern (already Monday UTC): no", !isSitrepTime(NY, new Date("2026-11-16T03:00:00Z")));

// ---- time you got back
check("standard minutes by default", minutesTable({}).agreed === false && minutesTable({}).table.drafted === DEFAULT_MINUTES.drafted);
const own = minutesTable({ sitrepMinutes: { drafted: 8, voice_note: "x" } });
check("a client's agreed minutes override, bad values ignored", own.agreed && own.table.drafted === 8 && own.table.voice_note === 10 && own.table.form_lead === 5, own);
check("time back = counts x minutes + hands-on time", JSON.stringify(timeBack({ drafted: 14, formLeads: 3, voice: 4 }, 30, DEFAULT_MINUTES)) === JSON.stringify({ auto: 125, person: 30, total: 155 }));

// ---- the number check
const sheet = { week: "Nov 9 to Nov 15", this_week: { drafted: 14 }, week_before: { drafted: 11 }, questions_we_could_not_answer: [{ question: "Do you fix tankless heaters?", times: 2 }] };
check("numbers from the facts pass", narrativeProblem("Drafts rose from 11 to 14 this week. One question came up 2 times.", sheet) === null);
check("an invented number is caught", /not in the facts: 27/.test(narrativeProblem("We saved you 27 hours.", sheet)));
check("an invented difference is caught", /not in the facts: 3/.test(narrativeProblem("Drafts were up by 3.", sheet)));
check("percentages are refused", narrativeProblem("Drafts rose 14 percent.", sheet) === "money or percentage" && narrativeProblem("Up 14%.", sheet) === "money or percentage");
check("dollar amounts are refused", narrativeProblem("That is worth $14.", sheet) === "money or percentage");
check("spelled-out quantities are refused", narrativeProblem("Drafts doubled, to a dozen.", sheet) === "spelled-out quantity");
check("too long is refused", narrativeProblem("word ".repeat(130), sheet) === "too long");
check("empty is refused", narrativeProblem("  ", sheet) === "empty");

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
await ensureClientAgentTables(env); await ensureGmTables(env); await ensureDoneTable(env);
db.exec(`CREATE TABLE gm_alerts (key TEXT PRIMARY KEY, title TEXT NOT NULL, opened_at TEXT NOT NULL, resolved_at TEXT);
  CREATE TABLE client_connections (id TEXT PRIMARY KEY, agent_id TEXT, email TEXT, status TEXT, connected_at TEXT, last_poll TEXT);`);
const profile = { business: "QA Test Plumbing", timezone: NY, ownerEmail: "owner@example.test" };
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_1','QA Test Plumbing','x',?,30,'2026-10-01T00:00:00Z')`).run(JSON.stringify(profile));
const agent = () => db.prepare(`SELECT * FROM client_agents WHERE id = 'ca_1'`).get();
const ev = (kind, summary, at) => db.prepare(`INSERT INTO client_agent_events (agent_id, kind, summary, created_at) VALUES ('ca_1', ?, ?, ?)`).run(kind, summary, at);

// The week of Nov 9 to Nov 15, and a little of the week before.
for (let i = 0; i < 4; i++) ev("drafted", `[Ask Me] "Leak" from Pat Customer <pat@example.test>: Question.`, `2026-11-1${i}T15:00:00.000Z`);
for (let i = 0; i < 2; i++) ev("drafted", `[Ask Me] "Old" from x: Question.`, `2026-11-04T15:00:00.000Z`);
ev("form_lead", "Form request from Dana", "2026-11-10T16:00:00.000Z");
ev("voice_note", "Voice note written up", "2026-11-11T16:00:00.000Z");
ev("needs_you", `[Never] "Refund" from Angry Person <angry@example.test>: Wants a refund.`, "2026-11-12T16:00:00.000Z");
ev("needs_you", `[Tell Me] EMERGENCY "Burst pipe" from Sam: Burst pipe.`, "2026-11-13T16:00:00.000Z");
ev("ignored", `[Handle It] "Newsletter" from n@example.test: Newsletter.`, "2026-11-13T17:00:00.000Z");
ev("drafted", `[Ask Me] "Next week" from y: Question.`, "2026-11-16T06:00:00.000Z"); // after the week ended
const refundId = db.prepare(`SELECT id FROM client_agent_events WHERE summary LIKE '%Refund%'`).get().id;
db.prepare(`INSERT INTO owner_done (event_id, agent_id, done_at) VALUES (?, 'ca_1', '2026-11-12T18:00:00Z')`).run(refundId);
db.prepare(`INSERT INTO gm_gaps (agent_id, question, asked_by, times, status, first_at, last_at) VALUES ('ca_1','Do you fix tankless heaters?','Intake',2,'open','2026-11-10','2026-11-12')`).run();
db.prepare(`INSERT INTO gm_answers (agent_id, question, answer, created_at) VALUES ('ca_1','Chesapeake?','Yes.','2026-11-11T10:00:00.000Z')`).run();
db.prepare(`INSERT INTO gm_alerts VALUES ('quiet:ca_1','QA: quiet','2026-11-11T14:00:00.000Z','2026-11-11T14:40:00.000Z')`).run();
db.prepare(`INSERT INTO gm_alerts VALUES ('quiet:ca_other','Other: quiet','2026-11-11T14:00:00.000Z','2026-11-11T15:00:00.000Z')`).run();
db.prepare(`INSERT INTO gm_alerts VALUES ('disconnected:ca_1','QA: still open','2026-11-14T14:00:00.000Z',NULL)`).run();

const week = lastWeek(NY, mon7);
const facts = await gatherFacts(env, agent(), week);
check("counts only this week's events", facts.counts.drafted === 4 && facts.counts.formLeads === 1 && facts.counts.voice === 1 && facts.counts.needsYou === 2 && facts.counts.setAside === 1, facts.counts);
check("emergency, handled and taught counted", facts.counts.emergencies === 1 && facts.counts.handled === 1 && facts.counts.taught === 1, facts.counts);
check("week before for comparison", facts.previous.drafted === 2 && facts.previous.formLeads === 0, facts.previous);
check("only this client's closed problems are listed", facts.fixes.length === 1 && /Wednesday: your inbox stopped being checked\. Back to normal after 40 minutes\./.test(facts.fixes[0]), facts.fixes);
check("open questions carried", facts.openQuestions[0].question === "Do you fix tankless heaters?" && facts.openQuestions[0].times === 2, facts.openQuestions);
check("time back from standard minutes", facts.timeBack.total === 4 * 5 + 1 * 5 + 1 * 10 && facts.minutes.agreed === false, facts.timeBack);
const forModel = JSON.stringify(factsForModel(week, facts));
check("the model never sees a customer's name or an email subject", !/Pat Customer|Angry Person|Refund|Burst pipe|example\.test|Dana/.test(forModel), forModel);

const text = composeSitrep({ business: "QA Test Plumbing", week, facts, narrative: "Drafts rose from 2 to 4." }).text;
check("report shows numbers with last week alongside", /- 4 draft replies written for you \(2 the week before\)/.test(text), text);
check("report says how time back was worked out", /About 35 min this week, by our standard task times \(5 minutes a drafted reply, 5 a form request, 10 a voice note\)/.test(text) && /an estimate, not a stopwatch/.test(text), text);
check("report has the paragraph, fixes and questions", /WHAT STOOD OUT\nDrafts rose from 2 to 4\./.test(text) && /WHAT WE CAUGHT AND FIXED/.test(text) && /tankless heaters\? \(asked 2 times\)/.test(text), text);
check("singular reads right", /- 1 email that wasn't from a customer set aside/.test(text) && /- 1 request came through your form/.test(text), text);
check("report promises nothing went to a customer", /Nothing in this report was sent to any customer/.test(text));
const agreedText = composeSitrep({ business: "QA", week, facts: { ...facts, minutes: { table: DEFAULT_MINUTES, agreed: true } }, narrative: null }).text;
check("agreed minutes are named as agreed; no paragraph, no heading", /by the times we agreed on your assessment/.test(agreedText) && !/WHAT STOOD OUT/.test(agreedText), agreedText);

// ---- sending
let paragraph = "Drafts rose from 2 to 4 this week, and 1 emergency was flagged the moment it came in. One question came up 2 times: \"Do you fix tankless heaters?\" Answering it will let us draft those replies for you.";
let modelMode = "ok", mailFails = false;
const mail = [], modelCalls = [];
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (String(url).includes("anthropic")) {
    modelCalls.push(body);
    if (modelMode === "down") return new Response("{}", { status: 529 });
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ paragraph }) }], usage: { input_tokens: 700, output_tokens: 400 } }));
  }
  if (String(url).includes("resend")) { if (mailFails) return new Response("no", { status: 500 }); mail.push(body); }
  return new Response("{}");
};
const reset = () => { mail.length = 0; modelCalls.length = 0; };

let r = await sendSitreps(env, new Date("2026-11-16T11:50:00Z"));
check("before 7 AM Monday nothing is built or sent", r.length === 0 && mail.length === 0 && modelCalls.length === 0, r);

r = await sendSitreps(env, new Date("2026-11-15T20:00:00Z"), { agentId: "ca_1", preview: true });
check("preview shows it without sending or recording", r[0].preview && /SITREP/.test(r[0].subject) && mail.length === 0 && !db.prepare(`SELECT 1 FROM sitreps`).get(), r[0] && r[0].subject);

reset();
r = await sendSitreps(env, mon7);
check("Monday 7 AM: sent to the owner, with a copy to Jerome", mail.length === 2 && mail[0].to[0] === "owner@example.test" && mail[1].to[0] === "jerome@example.test" && /^\[SITREP sent\]/.test(mail[1].subject), mail.map((m) => [m.to, m.subject]));
check("subject names the week", mail[0].subject === "Your SITREP: week of Nov 9 to Nov 15", mail[0].subject);
check("the paragraph passed the number check and is in the email", r[0].paragraph === "ok" && mail[0].text.includes("Answering it will let us draft those replies"), r);
check("one Sonnet call, structured output, low effort", modelCalls.length === 1 && modelCalls[0].model === STEP_UP_MODEL && modelCalls[0].output_config.format.type === "json_schema" && modelCalls[0].output_config.effort === "low" && !modelCalls[0].tool_choice, modelCalls[0] && modelCalls[0].model);
check("the request to the model has no customer names", !/Pat Customer|Angry Person|Burst pipe|example\.test/.test(JSON.stringify(modelCalls[0])));
const tok = db.prepare(`SELECT calls, input_tokens FROM client_agent_tokens WHERE agent_id='ca_1' AND model=?`).get(STEP_UP_MODEL);
// Two calls so far: the preview above also asked the model, and every call is counted.
check("its tokens are logged to the client's cost, previews included", tok && tok.calls === 2 && tok.input_tokens === 1400, tok);
check("recorded as sent", db.prepare(`SELECT status FROM sitreps WHERE agent_id='ca_1' AND week_start='2026-11-09'`).get().status === "sent");

reset();
r = await sendSitreps(env, new Date("2026-11-16T12:10:00Z"));
check("ten minutes later: not sent twice, no second model call", r.length === 0 && mail.length === 0 && modelCalls.length === 0, r);

reset(); paragraph = "We saved you 27 hours and drafts rose 300 percent.";
r = await sendSitreps(env, mon7, { agentId: "ca_1", force: true });
check("a paragraph with made-up numbers is dropped; the facts still go out", /paragraph dropped/.test(r[0].paragraph) && mail.length === 2 && !/27 hours/.test(mail[0].text) && !/WHAT STOOD OUT/.test(mail[0].text) && /THE WEEK IN NUMBERS/.test(mail[0].text), r);

reset(); modelMode = "down";
r = await sendSitreps(env, mon7, { agentId: "ca_1", force: true });
check("model down: the SITREP still goes out, facts only", mail.length === 2 && !/WHAT STOOD OUT/.test(mail[0].text), r);
modelMode = "ok"; paragraph = "A steady week.";

// A client with a quiet week, and one with no owner email.
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_2','Quiet Co','x',?,30,'2026-10-01T00:00:00Z')`).run(JSON.stringify({ business: "Quiet Co", timezone: NY, ownerEmail: "q@example.test" }));
db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES ('ca_3','No Email Co','x',?,30,'2026-10-01T00:00:00Z')`).run(JSON.stringify({ business: "No Email Co", timezone: NY }));
db.prepare(`INSERT INTO client_agent_events (agent_id, kind, summary, created_at) VALUES ('ca_3','drafted','x','2026-11-10T15:00:00.000Z')`).run();
reset();
r = await sendSitreps(env, mon7);
check("a week with nothing to report is skipped, with no model call", r.find((x) => x.agentId === "ca_2").skipped === "nothing_to_say" && !mail.some((m) => m.to[0] === "q@example.test"), r);
check("no owner email: skipped", r.find((x) => x.agentId === "ca_3").skipped === "no_owner_email", r);
reset();
r = await sendSitreps(env, new Date("2026-11-16T12:10:00Z"));
check("skipped weeks are recorded, so they aren't rebuilt every ten minutes", r.length === 0 && modelCalls.length === 0, r);

// Email down: recorded once, Jerome told (when mail returns), no retry loop.
db.prepare(`DELETE FROM sitreps WHERE agent_id='ca_1'`).run();
reset(); mailFails = true;
r = await sendSitreps(env, mon7);
check("email failure is reported", /Resend API error/.test(r.find((x) => x.agentId === "ca_1").error || ""), r);
check("and recorded as an error", db.prepare(`SELECT status FROM sitreps WHERE agent_id='ca_1'`).get().status === "error");
mailFails = false; reset();
r = await sendSitreps(env, new Date("2026-11-16T12:10:00Z"));
check("a failed week does not retry on its own (no repeat model calls)", r.length === 0 && modelCalls.length === 0 && mail.length === 0, r);
r = await sendSitreps(env, mon7, { agentId: "ca_1", force: true });
check("Jerome can resend it by hand", mail.length === 2 && db.prepare(`SELECT status FROM sitreps WHERE agent_id='ca_1'`).get().status === "sent", r);

// A paused client still hears the truth.
db.prepare(`UPDATE client_agents SET profile = ? WHERE id = 'ca_1'`).run(JSON.stringify({ ...profile, pausedAt: "2026-11-15T10:00:00Z" }));
r = await sendSitreps(env, mon7, { agentId: "ca_1", preview: true });
check("a paused client's SITREP says it is paused", /Everything is paused right now, at your request/.test(r[0].text), r[0].text.slice(0, 200));

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
