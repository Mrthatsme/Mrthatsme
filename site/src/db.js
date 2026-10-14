// Thin D1 helpers for the leads -> contracts -> clients -> payments pipeline.
// Schema: migrations/0001_init.sql

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export async function insertLead(db, { name, business, contact, phone, contactWindow, pain, source }) {
  const id = newId("lead");
  await db
    .prepare(
      `INSERT INTO leads (id, name, business, contact, phone, contact_window, pain, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, name, business, contact, phone || null, contactWindow || null, pain || null, source || "minutesregained.com", new Date().toISOString())
    .run();
  return id;
}

// How many leads this contact has sent in the window -- used so a form
// flooded with one address can't turn our auto-reply into a spam cannon.
export async function countRecentLeadsByContact(db, contact, sinceIso) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM leads WHERE lower(contact) = lower(?) AND created_at >= ?`)
    .bind(contact, sinceIso)
    .first();
  return row ? row.n : 0;
}

export async function insertContract(db, {
  leadId, planId, planLabel, priceCents, foundingOffer, billing,
  signerName, signerEmail, businessName,
  agreementIp, agreementUserAgent, contractVersion, contractTextHash,
  foundingCap, // when set, the insert is gated atomically on the live founding-offer count (see below)
}) {
  const id = newId("ctr");
  const now = new Date().toISOString();
  const bindArgs = [
    id, leadId || null, planId, planLabel, priceCents, foundingOffer ? 1 : 0,
    signerName, signerEmail, businessName,
    now, agreementIp || null, agreementUserAgent || null,
    contractVersion, contractTextHash, now, billing === "retainer" ? "retainer" : "monthly",
  ];

  let stmt;
  if (foundingOffer && typeof foundingCap === "number") {
    // Atomic check-and-insert: the founding-offer count and the insert are
    // the SAME statement, so concurrent requests can't all pass a separate
    // "is there room" check before any of them commits (the race that let
    // 6 contracts through a cap of 3 under concurrent load). SQLite/D1
    // serializes writes to a database, so this is race-proof regardless of
    // how many requests arrive at once.
    stmt = db.prepare(
      `INSERT INTO contracts (
        id, lead_id, plan_id, plan_label, price_cents, founding_offer,
        signer_name, signer_email, business_name,
        agreed_at, agreement_ip, agreement_user_agent,
        contract_version, contract_text_hash, status, created_at, billing
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?
      WHERE (SELECT COUNT(*) FROM contracts WHERE founding_offer = 1 AND status IN ('pending_payment','active')) < ?`
    ).bind(...bindArgs, foundingCap);
  } else {
    stmt = db.prepare(
      `INSERT INTO contracts (
        id, lead_id, plan_id, plan_label, price_cents, founding_offer,
        signer_name, signer_email, business_name,
        agreed_at, agreement_ip, agreement_user_agent,
        contract_version, contract_text_hash, status, created_at, billing
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)`
    ).bind(...bindArgs);
  }

  const result = await stmt.run();
  if (foundingOffer && typeof foundingCap === "number" && result.meta.changes === 0) {
    return null; // cap was full at the moment of insert -- no row written
  }
  return id;
}

export async function getContract(db, id) {
  return db.prepare(`SELECT * FROM contracts WHERE id = ?`).bind(id).first();
}

// Atomic claim so two concurrent /api/checkout calls for the same contract
// can't both create a live Stripe Checkout Session (a double-click, or a
// race, would otherwise produce two real Stripe sessions -- and if both
// got paid, two live subscriptions for one contract, with the second
// webhook silently overwriting the first's stripe_subscription_id). The
// sentinel value is replaced with the real session id once Stripe returns one.
const CHECKOUT_CLAIM_SENTINEL = "claiming";

export async function claimContractForCheckout(db, contractId) {
  const result = await db
    .prepare(
      `UPDATE contracts SET stripe_checkout_session_id = ?
       WHERE id = ? AND status = 'pending_payment' AND stripe_checkout_session_id IS NULL`
    )
    .bind(CHECKOUT_CLAIM_SENTINEL, contractId)
    .run();
  return result.meta.changes === 1;
}

export function isCheckoutClaimPending(sessionId) {
  return sessionId === CHECKOUT_CLAIM_SENTINEL;
}

export async function attachStripeSessionToContract(db, contractId, sessionId) {
  await db
    .prepare(`UPDATE contracts SET stripe_checkout_session_id = ? WHERE id = ?`)
    .bind(sessionId, contractId)
    .run();
}

export async function getContractByStripeSession(db, sessionId) {
  return db.prepare(`SELECT * FROM contracts WHERE stripe_checkout_session_id = ?`).bind(sessionId).first();
}

export async function activateContractAndClient(db, {
  contractId, stripeCustomerId, stripeSubscriptionId,
}) {
  const contract = await getContract(db, contractId);
  if (!contract) throw new Error("contract not found: " + contractId);

  await db
    .prepare(
      `UPDATE contracts SET status = 'active', stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?`
    )
    .bind(stripeCustomerId, stripeSubscriptionId, contractId)
    .run();

  const existing = await db
    .prepare(`SELECT id FROM clients WHERE contract_id = ?`)
    .bind(contractId)
    .first();
  if (existing) return existing.id;

  const clientId = newId("cli");
  await db
    .prepare(
      `INSERT INTO clients (
        id, contract_id, business_name, contact_name, contact_email,
        plan_id, stripe_customer_id, stripe_subscription_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .bind(
      clientId, contractId, contract.business_name, contract.signer_name, contract.signer_email,
      contract.plan_id, stripeCustomerId, stripeSubscriptionId, new Date().toISOString()
    )
    .run();

  if (contract.lead_id) {
    await db.prepare(`UPDATE leads SET status = 'converted' WHERE id = ?`).bind(contract.lead_id).run();
  }
  return clientId;
}

export async function recordPayment(db, { clientId, contractId, stripeEventId, stripeInvoiceId, amountCents, currency, status }) {
  const id = newId("pay");
  await db
    .prepare(
      `INSERT OR IGNORE INTO payments (
        id, client_id, contract_id, stripe_event_id, stripe_invoice_id, amount_cents, currency, status, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, clientId || null, contractId || null, stripeEventId, stripeInvoiceId || null, amountCents, currency || "usd", status, new Date().toISOString())
    .run();
  return id;
}

// Guardrail: caller checks the returned count against the configured daily
// cap BEFORE deciding to call the LLM. Best-effort, not perfectly race-safe
// under heavy concurrency -- that's fine, this is a spend brake, not a
// security boundary, and a handful of calls over the line is harmless.
export async function incrementAndGetTriageUsage(db) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db
    .prepare(
      `INSERT INTO triage_usage (usage_date, calls) VALUES (?, 1)
       ON CONFLICT(usage_date) DO UPDATE SET calls = calls + 1`
    )
    .bind(today)
    .run();
  const row = await db.prepare(`SELECT calls FROM triage_usage WHERE usage_date = ?`).bind(today).first();
  return row ? row.calls : 1;
}

export async function recordLeadTriage(db, { leadId, status, note, replyBody }) {
  await db
    .prepare(
      `UPDATE leads SET triage_status = ?, triage_note = ?, triage_reply_body = ?, triaged_at = ? WHERE id = ?`
    )
    .bind(status, note || null, replyBody || null, new Date().toISOString(), leadId)
    .run();
}

export async function listLeads(db, limit = 100) {
  const { results } = await db.prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return results;
}

export async function listContracts(db, limit = 100) {
  const { results } = await db.prepare(`SELECT * FROM contracts ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return results;
}

export async function listClients(db, limit = 100) {
  const { results } = await db.prepare(`SELECT * FROM clients ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return results;
}

export async function getClientByContractId(db, contractId) {
  return db.prepare(`SELECT * FROM clients WHERE contract_id = ?`).bind(contractId).first();
}

export async function countFoundingOfferTaken(db) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM contracts WHERE founding_offer = 1 AND status IN ('pending_payment', 'active')`
    )
    .first();
  return row ? row.n : 0;
}

export async function listPayments(db, limit = 100) {
  const { results } = await db.prepare(`SELECT * FROM payments ORDER BY occurred_at DESC LIMIT ?`).bind(limit).all();
  return results;
}
