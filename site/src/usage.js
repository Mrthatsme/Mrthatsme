// Voice-note allowance per client: counting, owner warnings, and month-end
// billing of anything over the plan's allowance (plans.js VOICE_OVERAGE).
//
// A client agent is tied to its paying client by profile.clientId (set with
// /api/admin/client-links). Until then, profile.plan can name the plan for
// counting and warnings; with neither, notes are counted but never billed.

import { PLANS, VOICE_OVERAGE } from "./plans.js";
import { sendNotificationEmail } from "./email.js";

const STRIPE_API = "https://api.stripe.com/v1";

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);   // "2026-10", UTC
const monthStart = (key) => `${key}-01T00:00:00.000Z`;
function nextMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// { planId, allowance, billing, stripeCustomerId } for an agent, or allowance null.
export async function voicePlan(env, agent, profile = JSON.parse(agent.profile || "{}")) {
  let planId = profile.plan || null, billing = profile.billing || "monthly", stripeCustomerId = null;
  if (profile.clientId) {
    const row = await env.DB.prepare(
      `SELECT c.plan_id, c.stripe_customer_id, k.billing FROM clients c LEFT JOIN contracts k ON k.id = c.contract_id WHERE c.id = ?`
    ).bind(profile.clientId).first().catch(() => null);
    if (row) { planId = row.plan_id; stripeCustomerId = row.stripe_customer_id; billing = row.billing || billing; }
  }
  const plan = planId && PLANS[planId];
  return { planId, allowance: plan ? plan.voiceNotes : null, billing, stripeCustomerId };
}

export async function voiceNotesInMonth(env, agentId, key = monthKey()) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM client_agent_events WHERE agent_id = ? AND kind = 'voice_note' AND created_at >= ? AND created_at < ?`
  ).bind(agentId, monthStart(key), monthStart(nextMonthKey(key))).first();
  return (row && row.n) || 0;
}

export const overageBlocks = (used, allowance) =>
  allowance == null || used <= allowance ? 0 : Math.ceil((used - allowance) / VOICE_OVERAGE.blockSize);

// Called after each voice note is written up. Warns the owner once at 80% and
// once when they first go over, so a charge is never a surprise.
export async function afterVoiceNote(env, agent, profile, ownerEmail) {
  const { allowance } = await voicePlan(env, agent, profile);
  if (!allowance) return;
  const used = await voiceNotesInMonth(env, agent.id);
  const warnAt = Math.ceil(allowance * 0.8);
  let text = null, subject = null;
  if (used === warnAt) {
    subject = `You've used ${used} of your ${allowance} voice notes this month`;
    text = `You've used ${used} of the ${allowance} voice notes included in your plan this month.\n\nAfter ${allowance}, each extra 100 (or part of 100) is $10, added to your bill for the month. The count starts over on the 1st.`;
  } else if (used === allowance + 1) {
    subject = `You're past your ${allowance} included voice notes this month`;
    text = `That was voice note ${used} this month; your plan includes ${allowance}.\n\nThey keep working. Each extra 100 (or part of 100) is $10, added to your bill for the month. The count starts over on the 1st.`;
  }
  if (!subject) return;
  await sendNotificationEmail(env, { to: ownerEmail, replyTo: "support@minutesregained.com", subject, text: `${text}\n\n-- Minutes Regained` })
    .catch((err) => console.error("voice allowance notice failed", err));
}

// One line per client for the brief.
export async function voiceUsageLine(env, agent) {
  const profile = JSON.parse(agent.profile || "{}");
  const used = await voiceNotesInMonth(env, agent.id);
  if (!used) return null;
  const { allowance } = await voicePlan(env, agent, profile);
  if (!allowance) return `  Voice notes this month: ${used} (no plan linked, so nothing is billed).`;
  const blocks = overageBlocks(used, allowance);
  return `  Voice notes this month: ${used} of ${allowance}${blocks ? `. OVER: $${(blocks * VOICE_OVERAGE.blockCents / 100).toFixed(2)} to bill on the 1st` : ""}.`;
}

async function stripePost(env, path, params) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || `Stripe ${path} failed (${res.status})`);
  return data;
}

// Runs on the 1st (morning run). Bills last month's overage once per client:
// monthly plans get an invoice item that rides on their next invoice; a
// Retainer gets its own invoice, charged to the card on file.
export async function billVoiceOverages(env, now = new Date()) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS voice_overage_billing (
    agent_id TEXT NOT NULL, month TEXT NOT NULL, used INTEGER NOT NULL, allowance INTEGER NOT NULL,
    blocks INTEGER NOT NULL, amount_cents INTEGER NOT NULL, stripe_ref TEXT, status TEXT NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY (agent_id, month))`).run();
  const prev = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const { results: agents } = await env.DB.prepare(`SELECT * FROM client_agents WHERE status = 'active'`).all();
  const report = [];
  for (const agent of agents || []) {
    const profile = JSON.parse(agent.profile || "{}");
    const plan = await voicePlan(env, agent, profile);
    if (!plan.allowance) continue;
    const used = await voiceNotesInMonth(env, agent.id, prev);
    const blocks = overageBlocks(used, plan.allowance);
    if (!blocks) continue;
    if (await env.DB.prepare(`SELECT 1 FROM voice_overage_billing WHERE agent_id = ? AND month = ?`).bind(agent.id, prev).first()) continue;
    const amount = blocks * VOICE_OVERAGE.blockCents;
    const description = `Voice notes over plan allowance, ${prev}: ${used} used, ${plan.allowance} included (${blocks} x 100)`;
    let ref = null, status = "not_billed_no_card";
    if (plan.stripeCustomerId && env.STRIPE_SECRET_KEY) {
      try {
        const item = await stripePost(env, "/invoiceitems", {
          customer: plan.stripeCustomerId, amount: String(amount), currency: "usd", description,
          "metadata[agent_id]": agent.id, "metadata[month]": prev,
        });
        ref = item.id; status = "added_to_next_invoice";
        if (plan.billing === "retainer") {
          const inv = await stripePost(env, "/invoices", {
            customer: plan.stripeCustomerId, collection_method: "charge_automatically", auto_advance: "true",
            pending_invoice_items_behavior: "include", description: `Voice notes over allowance, ${prev}`,
          });
          ref = inv.id; status = "invoiced";
        }
      } catch (err) {
        console.error("voice overage billing failed", err);
        status = `failed: ${String(err.message || err).slice(0, 120)}`;
      }
    }
    await env.DB.prepare(`INSERT INTO voice_overage_billing (agent_id, month, used, allowance, blocks, amount_cents, stripe_ref, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(agent.id, prev, used, plan.allowance, blocks, amount, ref, status, new Date().toISOString()).run();
    report.push(`- ${agent.label}: ${used} of ${plan.allowance} voice notes in ${prev}. $${(amount / 100).toFixed(2)}, ${status.replace(/_/g, " ")}.`);
  }
  if (report.length) {
    await sendNotificationEmail(env, {
      subject: `Voice-note overages for ${prev}`,
      text: `${report.join("\n")}\n\nMonthly clients see this on their next invoice; Retainer clients were sent their own invoice.`,
    }).catch((err) => console.error("overage report failed", err));
  }
  return report;
}
