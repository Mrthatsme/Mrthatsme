// Tests for read-only calendar access (connect.js) and the client's Daily Brief (clientbrief.js).
// Runs on Node's built-in SQLite in place of D1; Google, Microsoft and email are stubbed.
//   node site/tools/test_calendar.mjs
import { DatabaseSync } from "node:sqlite";
import { tzOffsetMinutes, localDay, findOverlaps, composeClientBrief, sendClientBriefs } from "../src/clientbrief.js";
import { hasCalendar, calendarEvents, _storeConnectionForTest, createConnectInvite, connectStart } from "../src/connect.js";
import { ensureClientAgentTables } from "../src/clientagent.js";

let fails = 0;
function check(name, cond, got) {
  if (cond) { console.log("ok  ", name); return; }
  fails++; console.log("FAIL", name, "\n     ", JSON.stringify(got));
}

// ---- time zones
const NY = "America/New_York";
check("New York is UTC-5 in November", tzOffsetMinutes(NY, new Date("2026-11-11T13:00:00Z")) === -300);
check("New York is UTC-4 in July", tzOffsetMinutes(NY, new Date("2026-07-11T13:00:00Z")) === -240);
let d = localDay(NY, new Date("2026-11-11T13:00:00Z"));
check("local day bounds", d.date === "2026-11-11" && d.start === "2026-11-11T05:00:00.000Z" && d.end === "2026-11-12T05:00:00.000Z", d);
d = localDay(NY, new Date("2026-11-12T03:30:00Z"));
check("late evening is still the local day", d.date === "2026-11-11", d);
d = localDay(NY, new Date("2026-03-08T15:00:00Z"));
check("clocks-forward day is 23 hours", d.start === "2026-03-08T05:00:00.000Z" && d.end === "2026-03-09T04:00:00.000Z", d);

// ---- overlaps and composing
const ev = [
  { title: "Smith water heater", location: "12 Oak St", start: "2026-11-11T14:00:00Z", end: "2026-11-11T15:30:00Z", allDay: false },
  { title: "Jones estimate", location: "", start: "2026-11-11T15:00:00Z", end: "2026-11-11T16:00:00Z", allDay: false },
  { title: "Back to back, fine", location: "", start: "2026-11-11T16:00:00Z", end: "2026-11-11T17:00:00Z", allDay: false },
  { title: "Van inspection", location: "", start: "2026-11-11", end: "2026-11-12", allDay: true },
];
const ov = findOverlaps(ev);
check("one overlap; back-to-back and all-day don't count", ov.length === 1 && ov[0][1].title === "Jones estimate", ov.map((p) => p.map((e) => e.title)));
let b = composeClientBrief({ business: "QA Test Plumbing", tz: NY, now: new Date("2026-11-11T13:00:00Z"), calendar: "ok", events: ev, waiting: ["Customer wants to reschedule"], came: { drafted: 2 }, hours: { used: 90, available: 480, carry: 0 } });
check("brief shows times in the owner's zone", /9:00 AM to 10:30 AM: Smith water heater \(12 Oak St\)/.test(b.text) && /All day: Van inspection/.test(b.text), b.text);
check("brief flags the overlap", /OVERLAPS TO CHECK/.test(b.text) && /"Smith water heater" and "Jones estimate" overlap at 10:00 AM/.test(b.text), b.text);
check("brief subject counts", b.subject === "Your Daily Brief: 4 on the calendar, 1 overlap, 1 waiting on you", b.subject);
check("brief says nothing went to customers", /Nothing in this brief was sent to any customer/.test(b.text));
b = composeClientBrief({ business: "X", tz: NY, calendar: "not_connected" });
check("empty day without calendar has nothing to say", b.hasContent === false && /isn't connected/.test(b.text), b);

// ---- D1 stand-in and stubs
const db = new DatabaseSync(":memory:");
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  first: async () => db.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: db.prepare(sql).all(...args) }),
  run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
});
const env = { DB: { prepare: (sql) => stmt(sql), batch: async (l) => { for (const s of l) await s.run(); } },
  RESEND_API_KEY: "t", NOTIFY_EMAIL: "jerome@example.test", TOKEN_ENC_KEY: "x".repeat(40),
  GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "g", MICROSOFT_CLIENT_ID: "m", MICROSOFT_CLIENT_SECRET: "m" };
const sent = [], tokenBodies = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("oauth2.googleapis.com/token") || url.includes("login.microsoftonline.com")) { tokenBodies.push(String(init.body)); return new Response(JSON.stringify({ access_token: "at" })); }
  if (url.includes("googleapis.com/calendar")) return new Response(JSON.stringify({ items: [
    { summary: "Smith water heater", location: "12 Oak St", start: { dateTime: "2026-11-11T09:00:00-05:00" }, end: { dateTime: "2026-11-11T10:30:00-05:00" }, status: "confirmed" },
    { summary: "Jones estimate", start: { dateTime: "2026-11-11T10:00:00-05:00" }, end: { dateTime: "2026-11-11T11:00:00-05:00" }, status: "confirmed" },
    { summary: "Cancelled one", start: { dateTime: "2026-11-11T12:00:00-05:00" }, end: { dateTime: "2026-11-11T13:00:00-05:00" }, status: "cancelled" },
  ] }));
  if (url.includes("graph.microsoft.com/v1.0/me/calendarView")) return new Response(JSON.stringify({ value: [
    { subject: "Outlook job", location: { displayName: "5 Elm" }, start: { dateTime: "2026-11-11T14:00:00.0000000" }, end: { dateTime: "2026-11-11T15:00:00.0000000" }, isAllDay: false, isCancelled: false },
  ] }));
  if (url.includes("resend")) { sent.push(JSON.parse(init.body)); return new Response("{}"); }
  return new Response("{}", { status: 404 });
};

await ensureClientAgentTables(env);
const now = new Date().toISOString();
const add = (id, profile) => db.prepare(`INSERT INTO client_agents (id, label, key_hash, profile, daily_cap, created_at) VALUES (?, ?, 'x', ?, 30, ?)`).run(id, id, JSON.stringify(profile), now);
add("ca_cal", { business: "QA Test Plumbing", ownerEmail: "owner@example.test", plan: "business_support" });
add("ca_nocal", { business: "Mail Only Co", ownerEmail: "mail@example.test" });
add("ca_quiet", { business: "Quiet Co", ownerEmail: "quiet@example.test" });
add("ca_ms", { business: "Outlook Co", ownerEmail: "ms@example.test" });
await _storeConnectionForTest(env, { id: "con_g", agentId: "ca_cal", provider: "google", email: "owner@example.test", refreshToken: "rt", scopes: "openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar.events.readonly" });
await _storeConnectionForTest(env, { id: "con_n", agentId: "ca_nocal", provider: "google", email: "mail@example.test", refreshToken: "rt", scopes: "openid email https://www.googleapis.com/auth/gmail.modify" });
await _storeConnectionForTest(env, { id: "con_m", agentId: "ca_ms", provider: "microsoft", email: "ms@example.test", refreshToken: "rt", scopes: "Mail.ReadWrite User.Read Calendars.Read openid email" });
db.prepare(`INSERT INTO client_agent_events (agent_id, kind, summary, created_at) VALUES ('ca_nocal', 'needs_you', 'URGENT "Change my appointment" from a@b.c', ?)`).run(now);

const conn = (id) => db.prepare(`SELECT * FROM client_connections WHERE id = ?`).get(id);
check("unticked calendar is respected", hasCalendar(conn("con_g")) && !hasCalendar(conn("con_n")) && hasCalendar(conn("con_m")));
check("no calendar permission: no calendar call", (await calendarEvents(env, conn("con_n"), "a", "b")) === null);
let es = await calendarEvents(env, conn("con_g"), "2026-11-11T05:00:00Z", "2026-11-12T05:00:00Z");
check("Google events read, cancelled left out", es.length === 2 && es[0].title === "Smith water heater" && es[0].location === "12 Oak St", es);
es = await calendarEvents(env, conn("con_m"), "2026-11-11T05:00:00Z", "2026-11-12T05:00:00Z");
check("Outlook events read as UTC", es.length === 1 && es[0].start === "2026-11-11T14:00:00Z" && es[0].location === "5 Elm", es);
check("Outlook refresh asks only for granted scopes", tokenBodies.some((t) => /scope=Mail\.ReadWrite/.test(t) && /Calendars\.Read/.test(t) && /offline_access/.test(t)), tokenBodies);

const at = new Date("2026-11-11T13:00:00Z");
let report = await sendClientBriefs(env, at);
const to = (addr) => sent.filter((m) => m.to[0] === addr);
check("calendar client gets a brief with the overlap", to("owner@example.test").length === 1 && /1 overlap/.test(to("owner@example.test")[0].subject), to("owner@example.test").map((m) => m.subject));
check("mail-only client gets a brief with what's waiting", to("mail@example.test").length === 1 && /isn't connected/.test(to("mail@example.test")[0].text) && /Change my appointment/.test(to("mail@example.test")[0].text), to("mail@example.test").map((m) => m.text));
check("quiet client gets nothing", to("quiet@example.test").length === 0 && report.some((r) => r.agentId === "ca_quiet" && r.skipped === "nothing_to_say"), report);
const before = sent.length;
await sendClientBriefs(env, new Date("2026-11-11T18:00:00Z"));
check("once per day", sent.length === before, sent.length - before);
report = await sendClientBriefs(env, at, { agentId: "ca_quiet", force: true });
check("admin can force one for testing", to("quiet@example.test").length === 1, report);

// ---- calendar is asked for only on calendar invites until Google verifies it
const scopeOf = async (inviteUrl, e = env) => {
  const tok = new URL(inviteUrl).searchParams.get("i");
  const res = await connectStart(e, new URL(`https://minutesregained.com/api/connect/start?i=${tok}&p=google`));
  return new URL(res.headers.get("Location")).searchParams.get("scope");
};
const plain = await createConnectInvite(env, "https://minutesregained.com", { agentId: "ca_quiet" });
const withCal = await createConnectInvite(env, "https://minutesregained.com", { agentId: "ca_quiet", calendar: true });
check("normal invite asks for email only", !/calendar/.test(await scopeOf(plain.url)), await scopeOf(plain.url));
check("calendar invite asks for read-only calendar", /calendar\.events\.readonly/.test(await scopeOf(withCal.url)), await scopeOf(withCal.url));
const plain2 = await createConnectInvite(env, "https://minutesregained.com", { agentId: "ca_quiet" });
check("CALENDAR_SCOPE=on turns it on for everyone", /calendar\.events\.readonly/.test(await scopeOf(plain2.url, { ...env, CALENDAR_SCOPE: "on" })));

console.log(fails ? `\n${fails} FAILED` : "\nAll passed.");
process.exit(fails ? 1 : 0);
