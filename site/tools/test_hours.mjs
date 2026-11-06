// Tests for the GM's hours ledger (site/src/hours.js). Runs the real code
// against Node's built-in SQLite in place of D1, with email captured, not sent.
//   node site/tools/test_hours.mjs
import { DatabaseSync } from "node:sqlite";
import { fmtMinutes, carryInto, splitEntries, buildProjection, createBuild, logTime, recordApproval,
  finishBuild, monthlyStatement, hoursLines, extraHoursReport, updateEstimate } from "../src/hours.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

// ---- pure logic
check("fmtMinutes", fmtMinutes(45) === "45 min" && fmtMinutes(120) === "2 hr" && fmtMinutes(260) === "4 hr 20 min", null);
check("carry: unused plan hours roll into next month", carryInto("2026-11", "2026-10", 480, { "2026-10": 300 }) === 180);
check("carry: none after going over", carryInto("2026-11", "2026-10", 480, { "2026-10": 600 }) === 0);
check("carry: rolled-over hours are used first and expire",
  carryInto("2026-11", "2026-09", 480, { "2026-09": 300, "2026-10": 200 }) === 460,
  carryInto("2026-11", "2026-09", 480, { "2026-09": 300, "2026-10": 200 }));
check("carry: never more than one month's plan", carryInto("2026-12", "2026-09", 480, {}) === 480);
check("carry: nothing before the client started", carryInto("2026-11", "2026-11", 480, {}) === 0);
const split = splitEntries([{ minutes: 300 }, { minutes: 150 }, { minutes: 90 }], 480);
check("split: extra starts where the hours run out", split[1].within === 150 && split[2].within === 30 && split[2].extra === 60, split);
check("projection: short when the rest won't fit", buildProjection({ estimate: 600, logged: 100, headroom: 380 }).short === 120);
check("projection: nothing without an estimate", buildProjection({ estimate: null, logged: 100, headroom: 0 }).short === 0);

// ---- D1 stand-in
const db = new DatabaseSync(":memory:");
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const sent = [];
globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); };
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) },
  RESEND_API_KEY: "test", NOTIFY_EMAIL: "jerome@example.test" };
db.exec(`CREATE TABLE client_agents (id TEXT PRIMARY KEY, label TEXT, key_hash TEXT, profile TEXT, daily_cap INTEGER,
  status TEXT DEFAULT 'active', last_seen TEXT, created_at TEXT)`);
db.prepare(`INSERT INTO client_agents VALUES ('ca_1', 'Harbor Ridge', 'x', ?, 30, 'active', NULL, '2026-11-01T00:00:00Z')`)
  .run(JSON.stringify({ plan: "business_support", ownerEmail: "owner@example.test" }));
db.prepare(`INSERT INTO client_agents VALUES ('ca_2', 'No Plan Co', 'x', '{}', 30, 'active', NULL, '2026-11-01T00:00:00Z')`).run();

const nov = (d) => new Date(`2026-11-${String(d).padStart(2, "0")}T15:00:00Z`);
const toClient = () => sent.filter((m) => m.to[0] === "owner@example.test");
let r;

r = await createBuild(env, { agentId: "ca_2", name: "X" }, nov(2));
check("no plan hours: build refused", r.error === "no_plan_hours", r);

r = await createBuild(env, { agentId: "ca_1", name: "Warranty reminders", estimateMinutes: 600, includedCustom: true }, nov(2));
const buildId = r.build && r.build.id;
check("estimate past the 8 hours warns at once", r.projection && r.projection.short === 120, r);
check("client is told and asked first", toClient().length === 1 && /heading past/.test(toClient()[0].subject) && /won't go past your hours without your OK/.test(toClient()[0].text), toClient());
check("Jerome gets a copy", sent.some((m) => m.to[0] === "jerome@example.test" && /Harbor Ridge/.test(m.subject)), sent.map((m) => m.subject));

r = await createBuild(env, { agentId: "ca_1", name: "Second", includedCustom: true }, nov(2));
check("only one included custom build", r.error === "included_custom_already_exists", r);

r = await logTime(env, { agentId: "ca_1", minutes: 60, task: "First call about what they need", kind: "conversation", buildId }, nov(3));
check("conversation time counts on the build", r.ok && r.status.used === 60, r);
r = await logTime(env, { agentId: "ca_1", minutes: 240, task: "Build and test", kind: "build", buildId }, nov(5));
check("no repeat warning for the same shortfall", r.ok && toClient().length === 1, toClient().length);

r = await logTime(env, { agentId: "ca_1", minutes: 200, task: "Inbox cleanup", kind: "admin" }, nov(6));
check("time past the hours is refused", r.error === "needs_client_ok" && r.minutesLeft === 180, r);
check("client told work is paused", toClient().some((m) => /needs more than your hours left/.test(m.subject) && /3 hr left this month/.test(m.text)), toClient().map((m) => m.subject));

r = await logTime(env, { agentId: "ca_1", minutes: 180, task: "More building", kind: "build", buildId }, nov(7));
check("up to the hours is fine", r.ok && r.status.headroom === 0, r);

r = await recordApproval(env, { agentId: "ca_1", minutes: 120, note: "x" }, nov(8));
check("approval needs a note quoting the OK", r.error === "note_must_quote_the_written_ok", r);
r = await recordApproval(env, { agentId: "ca_1", minutes: 120, note: "Email from Dana, Nov 8: OK up to 2 more hours" }, nov(8));
check("approval raises the limit", r.ok && r.status.limit === 600, r);

r = await logTime(env, { agentId: "ca_1", minutes: 120, task: "Finish and hand over", kind: "testing", buildId }, nov(9));
check("approved extra can be logged", r.ok && r.status.extraUsed === 120, r);
r = await logTime(env, { agentId: "ca_1", minutes: 5, task: "One more thing", kind: "admin" }, nov(9));
check("past approved extra is refused", r.error === "needs_client_ok", r);

r = await logTime(env, { agentId: "ca_1", minutes: 10, task: "Backdated", workDate: "2026-10-30" }, nov(9));
check("no logging into another month", r.error === "work_date_must_be_this_month", r);

const lines = await hoursLines(env, { id: "ca_1", label: "Harbor Ridge", profile: JSON.stringify({ plan: "business_support" }), created_at: "2026-11-01T00:00:00Z" });
check("brief shows the open build", lines.some((l) => /Warranty reminders/.test(l)), lines);

r = await finishBuild(env, { buildId });
check("GM totals the build", r.ok && r.totalMinutes === 600 && r.extraMinutes === 120 && r.extraCents === 15000, r);
check("finish note tells the client the split", toClient().some((m) => /is finished/.test(m.subject) && /8 hr came out of your plan hours/.test(m.text) && /\$150\.00/.test(m.text)), toClient().map((m) => m.text));
r = await updateEstimate(env, { buildId, estimateMinutes: 700 }, nov(10));
check("finished build can't be changed", r.error === "build_is_done", r);

r = await monthlyStatement(env, { agentId: "ca_1", month: "2026-11" });
check("statement lists every entry with its split", r.entries.length === 4 && r.totals.used === 600 && r.totals.extraUsed === 120 && r.totals.rollsOver === 0, r.totals);

const report = await extraHoursReport(env, new Date("2026-12-01T13:00:00Z"));
check("1st of the month lists extra to bill", report.length === 1 && /\$150\.00/.test(report[0]), report);
const again = sent.length; await extraHoursReport(env, new Date("2026-12-01T13:00:00Z"));
check("report email sent once", sent.length === again, sent.length - again);

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
