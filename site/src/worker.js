import { contractText, sha256Hex, CONTRACT_VERSION } from "./contract.js";
import { resolvePlan, FOUNDING_OFFER, normalizeBilling } from "./plans.js";
import {
  insertLead, insertContract, getContract, attachStripeSessionToContract,
  activateContractAndClient, recordPayment, getClientByContractId,
  countFoundingOfferTaken, listLeads, listContracts, listClients, listPayments,
  claimContractForCheckout, isCheckoutClaimPending,
} from "./db.js";
import { createCheckoutSession, retrieveCheckoutSession, verifyStripeSignature, updateCustomer } from "./stripe.js";
import { requireAdmin, unauthorizedResponse, renderAdminPage } from "./admin.js";
import { notifyNewClient, sendNotificationEmail } from "./email.js";
import { triageLead } from "./triage.js";
import { sendDailyBrief, isBriefHour } from "./brief.js";
import { screenSubmission, logSecurityEvent } from "./protect.js";
import { sendRenewalNotices } from "./renewals.js";
import { recordHeartbeat } from "./health.js";
import { createClientAgent, authenticateClientAgent, draftForClient, logClientAgentEvent } from "./clientagent.js";
import { createConnectInvite, connectLanding, connectStart, connectCallback, pollConnectedInboxes } from "./connect.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return undefined; // signals a malformed body to the caller
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/demo-video.mp4" && (request.method === "GET" || request.method === "HEAD")) {
        return await serveVideo(request, env, url);
      }
      if (path === "/api/contract-text" && request.method === "GET") {
        return handleContractText(url);
      }
      if (path === "/api/founding-status" && request.method === "GET") {
        const taken = await countFoundingOfferTaken(env.DB);
        return json({ available: taken < FOUNDING_OFFER.maxClients, remaining: Math.max(FOUNDING_OFFER.maxClients - taken, 0) });
      }
      if (path === "/api/leads" && request.method === "POST") {
        return await handleCreateLead(request, env, ctx);
      }
      if (path === "/api/agree" && request.method === "POST") {
        return await handleAgree(request, env);
      }
      if (path === "/api/checkout" && request.method === "POST") {
        return await handleCheckout(request, env, url);
      }
      if (path === "/api/stripe/webhook" && request.method === "POST") {
        return await handleStripeWebhook(request, env, ctx);
      }
      if (path === "/api/feedback" && request.method === "POST") {
        return await handleFeedback(request, env);
      }
      if (path === "/api/heartbeat" && request.method === "POST") {
        if (!(await tokenValid(request, env.HEARTBEAT_TOKEN))) return json({ error: "unauthorized" }, 401);
        const body = (await readJson(request)) || {};
        return (await recordHeartbeat(env, body.agent, body.detail)) ? json({ ok: true }) : json({ error: "unknown_agent" }, 400);
      }
      if (path === "/api/connect" && request.method === "GET") return await connectLanding(env, url);
      if (path === "/api/connect/start" && request.method === "GET") return await connectStart(env, url);
      const cb = path.match(/^\/api\/connect\/(google|microsoft)\/callback$/);
      if (cb && request.method === "GET") return await connectCallback(env, url, cb[1]);
      if (path.startsWith("/api/agent/") && request.method === "POST") {
        const agent = await authenticateClientAgent(request, env);
        if (!agent) return json({ error: "unauthorized" }, 401);
        const body = (await readJson(request)) || {};
        if (path === "/api/agent/draft") {
          try {
            return json(await draftForClient(env, agent, body));
          } catch (err) {
            console.error("client agent draft failed", err);
            await logClientAgentEvent(env, agent.id, "needs_you", `Drafting failed for "${body.subject || ""}"; needs a person.`);
            return json({ action: "handoff", reason: "Drafting failed; this one needs you." });
          }
        }
        if (path === "/api/agent/checkin") return json({ ok: true });
        return json({ error: "not found" }, 404);
      }
      if (path === "/api/ops/summary" && request.method === "GET") {
        if (!(await opsTokenValid(request, env))) return json({ error: "unauthorized" }, 401);
        return await handleOpsSummary(url, env);
      }
      if (path.startsWith("/api/admin/")) {
        if (!requireAdmin(request, env)) return unauthorizedResponse();
        if (path === "/api/admin/send-brief" && request.method === "POST") {
          await sendDailyBrief(env);
          return json({ sent: true });
        }
        // Which settings the live version can see: yes/no only, never values.
        if (path === "/api/admin/config-check" && request.method === "GET") {
          const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "TOKEN_ENC_KEY",
            "ANTHROPIC_API_KEY", "RESEND_API_KEY", "STRIPE_SECRET_KEY", "HEARTBEAT_TOKEN", "OPS_TOKEN"];
          return json(Object.fromEntries(keys.map((k) => [k, !!(env[k] && String(env[k]).trim())])));
        }
        if (path === "/api/admin/connect-invite" && request.method === "POST") {
          const body = (await readJson(request)) || {};
          if (!body.agentId && !body.label) return json({ error: "missing_label_or_agentId" }, 400);
          return json(await createConnectInvite(env, `${url.protocol}//${url.host}`, body));
        }
        if (path === "/api/admin/client-agent-status" && request.method === "POST") {
          const body = (await readJson(request)) || {};
          if (!body.id || !["active", "retired"].includes(body.status)) return json({ error: "invalid", allowed: ["active", "retired"] }, 400);
          const r = await env.DB.prepare(`UPDATE client_agents SET status = ? WHERE id = ?`).bind(body.status, body.id).run();
          return r.meta && r.meta.changes ? json({ ok: true }) : json({ error: "agent_not_found" }, 404);
        }
        if (path === "/api/admin/client-agent" && request.method === "POST") {
          const body = (await readJson(request)) || {};
          if (!body.label) return json({ error: "missing_label" }, 400);
          return json(await createClientAgent(env, body));
        }
        if (path === "/api/admin/contract-status" && request.method === "POST") {
          return await handleContractStatus(request, env);
        }
        if (path === "/api/admin/lead-status" && request.method === "POST") {
          return await handleLeadStatus(request, env);
        }
        return await handleAdmin(path, env);
      }
      if (!path.startsWith("/api/")) return await notFoundPage(env, url);
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "internal_error", message: String(err && err.message || err) }, 500);
    }
  },

  // 8 AM / 8 PM Eastern brief (cron in wrangler.toml).
  async scheduled(event, env, ctx) {
    // Connected client inboxes are checked every 10 minutes on their own cron,
    // so they never double up with the brief runs.
    if (event.cron === "*/10 * * * *") {
      ctx.waitUntil(pollConnectedInboxes(env).catch((err) => console.error("inbox poll failed", err)));
      return;
    }
    const at = new Date(event.scheduledTime);
    if (!isBriefHour(at)) return;
    ctx.waitUntil(sendDailyBrief(env).catch((err) => console.error("daily brief failed", err)));
    if (at.getUTCHours() >= 12) {
      ctx.waitUntil(sendRenewalNotices(env).catch((err) => console.error("renewal notices failed", err)));
    }
  },
};

function handleContractText(url) {
  const planId = url.searchParams.get("plan");
  const founding = url.searchParams.get("founding") === "1";
  const billing = normalizeBilling(url.searchParams.get("billing"));
  const businessName = url.searchParams.get("business") || "[Your business]";
  if (founding && billing !== "monthly") return json({ error: "founding_monthly_only" }, 400);
  const plan = resolvePlan(planId, founding, billing);
  if (!plan) return json({ error: "unknown_plan" }, 400);

  const text = contractText({ businessName, plan, foundingOffer: founding });
  return json({ text, version: CONTRACT_VERSION, plan: { id: plan.id, label: plan.label, priceCents: plan.priceCents, chargeCents: plan.chargeCents, interval: plan.interval, billing } });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// US/international phone: 10-15 digits once punctuation is stripped.
function validPhone(phone) {
  if (typeof phone !== "string") return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

// Byte-range support for the demo video: iPhone Safari refuses to play
// video from a server that ignores Range requests.
async function serveVideo(request, env, url) {
  const asset = await env.ASSETS.fetch(new Request(url.toString()));
  if (!asset.ok) return asset;
  const buf = await asset.arrayBuffer();
  const size = buf.byteLength;
  const base = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") || "");
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(request.method === "HEAD" ? null : buf, { status: 200, headers: { ...base, "Content-Length": String(size) } });
  }
  let start = m[1] === "" ? size - Number(m[2]) : Number(m[1]);
  let end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start < 0) start = 0;
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  }
  return new Response(request.method === "HEAD" ? null : buf.slice(start, end + 1), {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}

// Mistyped URLs get the site's own 404 page instead of raw JSON.
async function notFoundPage(env, url) {
  const page = await env.ASSETS.fetch(new Request(new URL("/404", url)));
  return new Response(page.body, { status: 404, headers: page.headers });
}

// "Report a problem" button: emails the report to support@.
async function handleFeedback(request, env) {
  if (Number(request.headers.get("Content-Length") || 0) > 20000) return json({ error: "too_large" }, 413);
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "invalid_form" }, 400);
  }
  const field = (k, max = 300) => String(form.get(k) || "").trim().slice(0, max);
  const screen = await screenSubmission(request, env, "/api/feedback", { honeypot: form.get("company_website"), elapsedMs: form.get("elapsed_ms") });
  if (!screen.ok) return screen.silent ? json({ ok: true }) : json({ error: "too_many_requests" }, 429);
  const what = field("what", 3000);
  if (!what) return json({ error: "missing_fields" }, 400);
  await logSecurityEvent(env, { kind: "accepted", path: "/api/feedback", hash: screen.hash });
  const lines = [
    `Where: ${field("where")}`,
    `What happened: ${what}`,
    `From: ${field("who") || "(not given)"}`,
    ``,
    `Page: ${field("page")}`,
    `Screen: ${field("screen")}`,
    `Theme: ${field("theme")}`,
    `Browser: ${field("browser", 500)}`,
    `Sent: ${field("at")}`,
  ];
  await sendNotificationEmail(env, { subject: `[Site problem report] ${field("where") || "website"}`, text: lines.join("\n") });
  return json({ ok: true });
}

const MAX_FIELD_LEN = 300;
const MAX_PAIN_LEN = 2000;

function clampLen(s, max) {
  return typeof s === "string" ? s.slice(0, max) : s;
}

async function handleCreateLead(request, env, ctx) {
  const body = await readJson(request);
  if (body === undefined) return json({ error: "invalid_json" }, 400);
  let { name, business, contact, phone, contactWindow, pain } = body || {};
  const screen = await screenSubmission(request, env, "/api/leads", { honeypot: (body || {}).company_website, elapsedMs: (body || {}).elapsed_ms });
  if (!screen.ok) return screen.silent ? json({ leadId: "received" }) : json({ error: "too_many_requests" }, 429);
  if (!name || !business || !contact) return json({ error: "missing_fields" }, 400);
  if (typeof contact !== "string" || !EMAIL_RE.test(contact.trim())) {
    await logSecurityEvent(env, { kind: "invalid_email", path: "/api/leads", hash: screen.hash });
    return json({ error: "invalid_email" }, 400);
  }
  if (phone && !validPhone(phone)) {
    await logSecurityEvent(env, { kind: "invalid_phone", path: "/api/leads", hash: screen.hash });
    return json({ error: "invalid_phone" }, 400);
  }
  await logSecurityEvent(env, { kind: "accepted", path: "/api/leads", hash: screen.hash });

  name = clampLen(name, MAX_FIELD_LEN);
  business = clampLen(business, MAX_FIELD_LEN);
  contact = clampLen(contact, MAX_FIELD_LEN);
  phone = clampLen(phone, MAX_FIELD_LEN);
  contactWindow = clampLen(contactWindow, MAX_FIELD_LEN);
  pain = clampLen(pain, MAX_PAIN_LEN);

  const leadId = await insertLead(env.DB, { name, business, contact, phone, contactWindow, pain, source: "minutesregained.com" });

  ctx.waitUntil(
    triageLead(env, { leadId, name, business, contact, phone, pain }).catch((err) =>
      console.error("lead triage failed", err)
    )
  );

  return json({ leadId });
}

async function handleAgree(request, env) {
  const body = await readJson(request);
  if (body === undefined) return json({ error: "invalid_json" }, 400);
  const { planId, founding, signerName, signerEmail, businessName, leadId } = body || {};
  const billing = normalizeBilling((body || {}).billing);
  if (!planId || !signerName || !signerEmail || !businessName) return json({ error: "missing_fields" }, 400);

  if (founding && billing !== "monthly") return json({ error: "founding_monthly_only" }, 400);
  const plan = resolvePlan(planId, !!founding, billing);
  if (!plan) return json({ error: "unknown_plan" }, 400);

  if (founding) {
    // Fast-path rejection so an obviously-full offer doesn't even attempt a
    // write. Not the actual guard -- insertContract's atomic conditional
    // insert below is what actually enforces the cap under concurrency.
    const taken = await countFoundingOfferTaken(env.DB);
    if (taken >= plan.maxClients) {
      return json({ error: "founding_offer_full" }, 409);
    }
  }

  const text = contractText({ businessName, plan, foundingOffer: !!founding });
  const hash = await sha256Hex(text);

  const contractId = await insertContract(env.DB, {
    leadId: leadId || null,
    planId: plan.id,
    planLabel: plan.label,
    priceCents: plan.priceCents,
    foundingOffer: !!founding,
    billing,
    signerName,
    signerEmail,
    businessName,
    agreementIp: clientIp(request),
    agreementUserAgent: request.headers.get("User-Agent") || "",
    contractVersion: CONTRACT_VERSION,
    contractTextHash: hash,
    foundingCap: founding ? plan.maxClients : undefined,
  });

  if (contractId === null) {
    return json({ error: "founding_offer_full" }, 409);
  }

  // The signer's copy: the exact text they agreed to, plus the record of how
  // it was signed. A copy goes to support@ for our file.
  const certificate = [
    `SIGNATURE RECORD`,
    `Signed by: ${signerName} (${signerEmail}) for ${businessName}`,
    `Signed at: ${new Date().toISOString()} (UTC), from IP ${clientIp(request) || "unknown"}`,
    `Agreement: version ${CONTRACT_VERSION}, record ${contractId}`,
    `Fingerprint (SHA-256 of the exact text below): ${hash}`,
    `Method: read to the end, checked "I agree", typed full name.`,
  ].join("\n");
  const copy = `${certificate}\n\n----------------------------------------\n\n${text}`;
  try {
    await sendNotificationEmail(env, { to: signerEmail, replyTo: "support@minutesregained.com", subject: "Your signed Minutes Regained service agreement", text: copy });
    await sendNotificationEmail(env, { subject: `[Agreement signed] ${businessName} (${plan.label})`, text: copy });
  } catch (err) {
    console.error("signed copy email failed", err);
  }

  return json({ contractId });
}

async function handleCheckout(request, env, url) {
  const body = await readJson(request);
  if (body === undefined) return json({ error: "invalid_json" }, 400);
  const { contractId } = body || {};
  if (!contractId) return json({ error: "missing_contract_id" }, 400);

  let contract = await getContract(env.DB, contractId);
  if (!contract) return json({ error: "contract_not_found" }, 404);

  // Idempotent reuse: a contract that already has a real Stripe session
  // (a page reload, a retry, a second tab) gets that same session back
  // instead of a new one, as long as Stripe still considers it open.
  if (contract.stripe_checkout_session_id && !isCheckoutClaimPending(contract.stripe_checkout_session_id)) {
    const existing = await retrieveCheckoutSession(env.STRIPE_SECRET_KEY, contract.stripe_checkout_session_id);
    if (existing && existing.status === "open" && existing.url) {
      return json({ url: existing.url });
    }
    // Expired/completed/errored -- fall through only if the contract itself
    // is still pending_payment (a completed session would have flipped it
    // to 'active' via the webhook already).
  }

  if (contract.status !== "pending_payment") return json({ error: "contract_not_pending" }, 409);

  const claimed = await claimContractForCheckout(env.DB, contractId);
  if (!claimed) {
    // Lost the race to a concurrent request. Check what it left behind.
    contract = await getContract(env.DB, contractId);
    if (contract.stripe_checkout_session_id && !isCheckoutClaimPending(contract.stripe_checkout_session_id)) {
      const existing = await retrieveCheckoutSession(env.STRIPE_SECRET_KEY, contract.stripe_checkout_session_id);
      if (existing && existing.url) return json({ url: existing.url });
    }
    return json({ error: "checkout_in_progress", message: "A checkout session is already being created for this contract -- please retry in a moment." }, 409);
  }

  const plan = resolvePlan(contract.plan_id, !!contract.founding_offer, contract.billing);
  const priceId = env[plan.envKey];
  if (!priceId) return json({ error: "stripe_price_not_configured", envKey: plan.envKey }, 500);

  const origin = `${url.protocol}//${url.host}`;
  const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
    priceId,
    contractId,
    customerEmail: contract.signer_email,
    businessName: contract.business_name,
    planLabel: plan.label,
    successUrl: `${origin}/start.html?status=success&contract=${contractId}`,
    cancelUrl: `${origin}/start.html?status=canceled&contract=${contractId}`,
  });

  await attachStripeSessionToContract(env.DB, contractId, session.id);
  return json({ url: session.url });
}

async function handleStripeWebhook(request, env, ctx) {
  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature");
  const ok = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: "bad_signature" }, 400);

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const contractId = session.client_reference_id || session.metadata?.contract_id;
    if (contractId) {
      const contract = await getContract(env.DB, contractId);
      const clientId = await activateContractAndClient(env.DB, {
        contractId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
      });
      if (contract && session.customer) {
        ctx.waitUntil(
          updateCustomer(env.STRIPE_SECRET_KEY, session.customer, { name: contract.business_name, contractId })
            .catch((err) => console.error("stripe customer name update failed", err))
        );
      }
      if (contract) {
        ctx.waitUntil(
          notifyNewClient(env, {
            clientId,
            businessName: contract.business_name,
            contactName: contract.signer_name,
            contactEmail: contract.signer_email,
            planId: contract.plan_id,
          }).catch((err) => console.error("client notification failed", err))
        );
      }
    }
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const contractId = invoice.subscription_details?.metadata?.contract_id;
    const client = contractId ? await getClientByContractId(env.DB, contractId) : null;

    await recordPayment(env.DB, {
      clientId: client ? client.id : null,
      contractId: contractId || null,
      stripeEventId: event.id,
      stripeInvoiceId: invoice.id,
      amountCents: invoice.amount_paid || invoice.amount_due || 0,
      currency: invoice.currency || "usd",
      status: event.type === "invoice.paid" ? "paid" : "failed",
    });
  }

  return json({ received: true });
}

// Read-only key for the scheduled operations agent. Separate from the
// admin password so it can be revoked on its own and can never write.
function opsTokenValid(request, env) {
  return tokenValid(request, env.OPS_TOKEN);
}

// Background agents check in with their own key, separate from OPS_TOKEN.
async function tokenValid(request, expected) {
  const auth = request.headers.get("Authorization") || "";
  if (!expected || !auth.startsWith("Bearer ")) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(auth.slice(7))),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function handleOpsSummary(url, env) {
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "7", 10) || 7, 1), 90);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [leads, contracts, clients, payments] = await Promise.all([
    listLeads(env.DB, 500), listContracts(env.DB, 500), listClients(env.DB, 500), listPayments(env.DB, 500),
  ]);
  const recent = (rows, field) => rows.filter((r) => (r[field] || "") >= since);
  const recentLeads = recent(leads, "created_at");
  return json({
    window_days: days,
    since,
    counts: {
      new_leads: recentLeads.length,
      leads_auto_replied: recentLeads.filter((l) => l.triage_status === "auto_replied").length,
      leads_needing_human: recentLeads.filter((l) => l.triage_status === "escalated" || l.triage_status === "failed").length,
      contracts_pending_payment: contracts.filter((c) => c.status === "pending_payment").length,
      active_clients: clients.filter((c) => c.status === "active").length,
      failed_payments_in_window: recent(payments, "occurred_at").filter((p) => p.status === "failed").length,
    },
    leads: recentLeads,
    contracts: recent(contracts, "created_at"),
    clients,
    payments: recent(payments, "occurred_at"),
  });
}

// Mark a lead's stage by hand, e.g. "test" for the owner's own site tests,
// so the brief's scoreboard counts only real inquiries.
const LEAD_STATUSES = ["new", "contacted", "assessed", "converted", "lost", "test"];

async function handleLeadStatus(request, env) {
  const body = (await readJson(request)) || {};
  if (!body.id || !LEAD_STATUSES.includes(body.status)) {
    return json({ error: "invalid", allowed: LEAD_STATUSES }, 400);
  }
  const res = await env.DB.prepare(`UPDATE leads SET status = ? WHERE id = ?`).bind(body.status, body.id).run();
  return res.meta && res.meta.changes ? json({ ok: true }) : json({ error: "lead_not_found" }, 404);
}

// Mark an agreement (and its client, if one was created) as a test or as
// canceled, so the brief's money section counts only real business.
async function handleContractStatus(request, env) {
  const body = (await readJson(request)) || {};
  if (!body.id || !["test", "canceled"].includes(body.status)) {
    return json({ error: "invalid", allowed: ["test", "canceled"] }, 400);
  }
  const res = await env.DB.prepare(`UPDATE contracts SET status = ? WHERE id = ?`).bind(body.status, body.id).run();
  await env.DB.prepare(`UPDATE clients SET status = ? WHERE contract_id = ?`).bind(body.status, body.id).run();
  return res.meta && res.meta.changes ? json({ ok: true }) : json({ error: "contract_not_found" }, 404);
}

async function handleAdmin(path, env) {
  const [leads, contracts, clients, payments] = await Promise.all([
    listLeads(env.DB), listContracts(env.DB), listClients(env.DB), listPayments(env.DB),
  ]);

  if (path === "/api/admin/dashboard") {
    return new Response(renderAdminPage({ leads, contracts, clients, payments }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return json({ leads, contracts, clients, payments });
}
