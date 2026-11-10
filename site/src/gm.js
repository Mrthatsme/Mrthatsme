// The GM: the agent that oversees the others.
//
// It holds what the other agents may need to know about a client and hands it
// out as skills. An agent that doesn't know something asks the GM instead of
// guessing. When the GM has no answer either, it records the question as a
// gap; the owner-operator answers it once on the dashboard, and from then on
// the GM can supply it to every agent.
//
// The GM decides nothing on its own. It never sends anything to a customer,
// never quotes a price and never makes a commitment: an answer it stores is
// one a person approved, and a price is refused outright.
//
// Its oversight shows up in the brief as "THE GM": open questions, hours and
// builds, client by client.

import { statusFor, fmtMinutes, buildProjection, hoursLines } from "./hours.js";

const STOP = new Set(("a an and are as at be can could did do does for from have how i if in is it me my of on or our " +
  "so that the their them there they this to was we what when where which who will with would you your yes no please " +
  "hi hello thanks thank just get got about any").split(" "));

// Content words, lowercased, light stemming so "services"/"service" match.
export function words(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|es|s)$/, ""));
}

// How well a stored question covers an asked one: share of the asked
// question's words found in the stored one. Deterministic, no model call.
export function overlap(asked, stored) {
  const a = [...new Set(words(asked))], s = new Set(words(stored));
  if (!a.length) return 0;
  return a.filter((w) => s.has(w)).length / a.length;
}

const MATCH = 0.6;

// Score a stored question-and-answer against an asked question, both ways:
// the asked words found in the stored question or its answer, or the stored
// question's words found in what was asked.
export function matchScore(asked, q, a = "") {
  return Math.max(overlap(asked, `${q} ${a}`), overlap(q, asked));
}

// "Q: ... A: ..." or "question? answer" lines in a client's approved answers.
export function parseApproved(text) {
  return String(text || "").split(/\n+/).map((line) => {
    const m = line.match(/^\s*(?:Q:)?\s*(.+?\?)\s*(?:A:)?\s*(.+)$/i);
    return m ? { q: m[1].trim(), a: m[2].trim() } : null;
  }).filter(Boolean);
}

// An answer the GM may hand out must not be a price or a money figure.
export function answerAllowed(answer) {
  return !/\$\s*\d|\d+\s*(dollars|usd)\b|\bper hour\b/i.test(String(answer || ""));
}

let ready = false;
export async function ensureGmTables(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gm_gaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, question TEXT NOT NULL, asked_by TEXT NOT NULL,
      times INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open', first_at TEXT NOT NULL, last_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_gm_gaps ON gm_gaps (agent_id, status)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gm_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL,
      approved_note TEXT, created_at TEXT NOT NULL)`),
  ]);
  ready = true;
}

const prof = (agent) => JSON.parse(agent.profile || "{}");

// ------------------------------------------------------------------ skills --
// Each skill takes (env, agent, query) and returns { answer } or { answer: null }.

async function answerFor(env, agent, query) {
  await ensureGmTables(env);
  const { results } = await env.DB.prepare(`SELECT question, answer FROM gm_answers WHERE agent_id = ? ORDER BY id DESC`).bind(agent.id).all();
  const pool = [...(results || []).map((r) => ({ q: r.question, a: r.answer, from: "learned" })),
    ...parseApproved(prof(agent).approvedAnswers).map((x) => ({ ...x, from: "approved" }))];
  let best = null, score = 0;
  for (const item of pool) {
    const s = matchScore(query, item.q, item.a);
    if (s > score) { score = s; best = item; }
  }
  return best && score >= MATCH && answerAllowed(best.a) ? { answer: best.a, matched: best.q, from: best.from } : { answer: null };
}

function describeSchedule(entries) {
  return [].concat(entries || []).map((h) => `${Array.isArray(h.days) ? h.days.join(",") : h.days || "daily"} ${h.from}-${h.to}`).join("; ");
}

export const SKILLS = {
  // A question a customer asked that the asking agent couldn't answer.
  answer: answerFor,
  // When the business is open, from the client's own settings.
  business_hours: async (env, agent) => {
    const h = prof(agent).businessHours;
    return { answer: h ? `Business hours: ${describeSchedule(h)} (${prof(agent).timezone || "local time"}).` : null };
  },
  service_area: async (env, agent) => ({ answer: prof(agent).area ? `Service area: ${prof(agent).area}.` : null }),
  // Who to route to right now. Names only; never handed to a customer.
  on_call_now: async (env, agent) => {
    const { onCallNow } = await import("./clientagent.js");
    const list = onCallNow(prof(agent));
    return { answer: list.length ? list.map((c) => c.name || c.email).join(", ") : null, internal: true };
  },
  // The client's rules: tone, what never to say, permission levels.
  client_rules: async (env, agent) => {
    const p = prof(agent);
    return { answer: { tone: p.tone || "friendly and plain", neverSay: p.neverSay || "", signOff: p.signOff || "", levels: p.levels || {} }, internal: true };
  },
  // Today's calendar, read-only. Internal: a customer is never given a time from it.
  schedule_today: async (env, agent) => {
    const { todaysEvents } = await import("./clientbrief.js");
    const events = await todaysEvents(env, agent).catch(() => null);
    return { answer: events, internal: true };
  },
  hours_status: async (env, agent) => {
    const s = await statusFor(env, agent).catch(() => null);
    return { answer: s ? { used: s.used, available: s.available, headroom: s.headroom, extraUsed: s.extraUsed } : null, internal: true };
  },
};

// Any agent calls this. `from` names the asking agent (Intake, Quotes, the
// client's inbox script...). Every ask is logged; an unanswered "answer" ask
// becomes a gap for the owner-operator.
export async function askGM(env, agent, { from = "an agent", skill = "answer", query = "" } = {}) {
  await ensureGmTables(env);
  const fn = SKILLS[skill];
  if (!fn) return { error: "unknown_skill", skills: Object.keys(SKILLS) };
  const out = await fn(env, agent, String(query).slice(0, 300));
  if (out.answer == null && skill === "answer" && query) await recordGap(env, agent, query, from);
  return { skill, ...out };
}

export async function recordGap(env, agent, question, from) {
  await ensureGmTables(env);
  const q = String(question).trim().slice(0, 300);
  if (!q) return;
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(`SELECT id, question FROM gm_gaps WHERE agent_id = ? AND status = 'open'`).bind(agent.id).all();
  const same = (results || []).find((g) => overlap(q, g.question) >= 0.8 && overlap(g.question, q) >= 0.8);
  if (same) {
    await env.DB.prepare(`UPDATE gm_gaps SET times = times + 1, last_at = ? WHERE id = ?`).bind(now, same.id).run();
  } else {
    await env.DB.prepare(`INSERT INTO gm_gaps (agent_id, question, asked_by, first_at, last_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(agent.id, q, String(from).slice(0, 40), now, now).run();
  }
}

// The drafting agent's gaps: ask the GM for each. Returns the facts the GM
// had, ready to hand back to the drafter for one redraft.
export async function fillGaps(env, agent, gaps, from) {
  const facts = [];
  for (const g of (gaps || []).slice(0, 5)) {
    const r = await askGM(env, agent, { from, skill: "answer", query: g });
    if (r.answer) facts.push(`${r.matched || g} ${r.answer}`);
  }
  return facts;
}

// ------------------------------------------------------------ admin calls --

// Save an answer the owner approved. Closes every open gap it covers.
export async function saveAnswer(env, { agentId, question, answer, gapId, note }) {
  await ensureGmTables(env);
  const agent = await env.DB.prepare(`SELECT * FROM client_agents WHERE id = ?`).bind(agentId).first();
  if (!agent) return { error: "agent_not_found" };
  let q = String(question || "").trim();
  if (gapId && !q) {
    const g = await env.DB.prepare(`SELECT question FROM gm_gaps WHERE id = ? AND agent_id = ?`).bind(gapId, agentId).first();
    if (!g) return { error: "gap_not_found" };
    q = g.question;
  }
  const a = String(answer || "").trim();
  if (q.length < 5 || a.length < 2) return { error: "missing_question_or_answer" };
  if (!answerAllowed(a)) return { error: "no_prices", message: "The GM never hands out prices or money figures. Leave those for the owner to give in person." };
  await env.DB.prepare(`INSERT INTO gm_answers (agent_id, question, answer, approved_note, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(agentId, q.slice(0, 300), a.slice(0, 600), note ? String(note).slice(0, 200) : null, new Date().toISOString()).run();
  const { results } = await env.DB.prepare(`SELECT id, question FROM gm_gaps WHERE agent_id = ? AND status = 'open'`).bind(agentId).all();
  const closed = (results || []).filter((g) => g.id === Number(gapId) || overlap(g.question, q) >= MATCH);
  for (const g of closed) await env.DB.prepare(`UPDATE gm_gaps SET status = 'answered' WHERE id = ?`).bind(g.id).run();
  return { ok: true, closedGaps: closed.length };
}

export async function dismissGap(env, { agentId, gapId }) {
  await ensureGmTables(env);
  const r = await env.DB.prepare(`UPDATE gm_gaps SET status = 'dismissed' WHERE id = ? AND agent_id = ? AND status = 'open'`).bind(gapId, agentId).run();
  return r.meta && r.meta.changes ? { ok: true } : { error: "gap_not_found" };
}

export async function openGaps(env, agentId) {
  await ensureGmTables(env);
  const { results } = await env.DB.prepare(`SELECT * FROM gm_gaps WHERE agent_id = ? AND status = 'open' ORDER BY times DESC, last_at DESC LIMIT 20`).bind(agentId).all();
  return results || [];
}

// --------------------------------------------------------------- oversight --

// The brief's "THE GM" section: per client, what the agents couldn't answer,
// hours and builds. Clients with nothing to report are left out.
export async function gmLines(env, agents) {
  await ensureGmTables(env);
  const lines = [];
  for (const a of agents || []) {
    const gaps = await openGaps(env, a.id);
    const hours = await hoursLines(env, a).catch(() => []);
    if (!gaps.length && !hours.length) continue;
    lines.push(`- ${a.label}:`);
    if (gaps.length) {
      lines.push(`  ${gaps.length} question(s) the agents couldn't answer. Answer once on the dashboard and the GM hands it to every agent:`);
      gaps.slice(0, 3).forEach((g) => lines.push(`    "${g.question}"${g.times > 1 ? ` (asked ${g.times} times)` : ""}, from ${g.asked_by}`));
    }
    lines.push(...hours);
  }
  return lines.length ? ["THE GM", ...lines] : [];
}

// Every active client with open questions, for the dashboard.
export async function dashboardGaps(env) {
  await ensureGmTables(env);
  const { results: agents } = await env.DB.prepare(`SELECT id, label FROM client_agents WHERE status = 'active' ORDER BY label`).all()
    .catch(() => ({ results: [] }));
  const out = [];
  for (const a of agents || []) {
    const gaps = await openGaps(env, a.id);
    if (gaps.length) out.push({ id: a.id, label: a.label, gaps });
  }
  return out;
}
