// The service agreement, readable without script: a plain page at /agreement,
// and the same text placed into /start before the page reaches the browser.
//
// Sign-ups (the e-signature and the Stripe checkout) stay closed until the
// attorney-reviewed agreement is countersigned. Opening them is one setting:
// SIGNUPS_OPEN = "true" in the Worker's variables. Until then the server
// refuses /api/agree and /api/checkout, whatever the page does.

import { contractText, CONTRACT_VERSION } from "./contract.js";
import { PLANS, resolvePlan, normalizeBilling } from "./plans.js";

export const BOOK_URL = "https://calendar.app.google/mL2TQQSCAgLAURZC6";
const PHONE_DISPLAY = "(877) 896-8784";
const PHONE_TEL = "+18778968784";

export function signupsOpen(env) {
  return String((env && env.SIGNUPS_OPEN) || "").trim().toLowerCase() === "true";
}

export const SIGNUPS_CLOSED_MESSAGE =
  "Sign-ups open once our attorney-reviewed service agreement is back. Nothing can be signed or paid for until then.";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Read plan/billing/founding from a URL, falling back to Business Support,
// monthly, no founding offer when the combination doesn't exist.
export function agreementChoice(url) {
  const planId = PLANS[url.searchParams.get("plan")] ? url.searchParams.get("plan") : "business_support";
  const billing = normalizeBilling(url.searchParams.get("billing"));
  let founding = url.searchParams.get("founding") === "1";
  let plan = resolvePlan(planId, founding, billing);
  if (!plan) { founding = false; plan = resolvePlan(planId, false, billing); }
  return { planId, billing, founding, plan, text: contractText({ businessName: "[Your business]", plan, foundingOffer: founding }) };
}

export function agreementHref({ planId, billing, founding }) {
  const p = new URLSearchParams({ plan: planId, billing });
  if (founding) p.set("founding", "1");
  return `/agreement?${p.toString()}`;
}

function variantLinks(current) {
  const rows = [];
  for (const [id, base] of Object.entries(PLANS)) {
    for (const billing of ["monthly", "retainer"]) {
      rows.push({ planId: id, billing, founding: false, label: `${base.label}, ${billing === "retainer" ? "12-month Retainer" : "monthly"}` });
    }
  }
  rows.splice(3, 0, { planId: "business_support", billing: "monthly", founding: true, label: "Business Support, Founding Client offer" });
  return rows.map((r) => {
    const on = r.planId === current.planId && r.billing === current.billing && r.founding === current.founding;
    return on
      ? `<li><b aria-current="page">${esc(r.label)}</b></li>`
      : `<li><a href="${esc(agreementHref(r))}">${esc(r.label)}</a></li>`;
  }).join("");
}

export function agreementPage(env, url) {
  const choice = agreementChoice(url);
  const open = signupsOpen(env);
  const status = open
    ? `<p class="ag-status">This is the agreement a client signs at <a href="/start">minutesregained.com/start</a>.</p>`
    : `<p class="ag-status"><b>This is the current draft.</b> It is with our attorney, and no one is signing or paying until it's back. If something in your week is falling through, <a href="${BOOK_URL}" target="_blank" rel="noopener">book a free assessment</a> anyway.</p>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,follow">
<meta name="description" content="The Minutes Regained service agreement, version ${esc(CONTRACT_VERSION)}, in full.">
<link rel="canonical" href="https://minutesregained.com/agreement">
<link rel="icon" href="/mark.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32">
<title>Service agreement — Minutes Regained</title>
<link rel="stylesheet" href="/site.css?v=20261022">
<style>
.ag-wrap{max-width:760px;padding-block:clamp(32px,6vw,64px) 80px}
.ag-status{border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;padding:14px 16px;margin:16px 0 0}
.ag-plans{margin:20px 0 0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:8px 16px;font-size:14.5px}
.ag-text{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 var(--mono);background:var(--log-bg);color:var(--log-fg);border-radius:10px;padding:clamp(16px,4vw,24px);margin:20px 0}
.ag-meta{font-size:14px;color:var(--muted)}
.nav .tel{font-weight:600;text-decoration:none;white-space:nowrap}
</style>
</head>
<body>
<header class="top"><div class="wrap nav">
  <a class="brand" href="/">Minutes<span class="acc">Regained</span></a>
  <a class="tel" href="tel:${PHONE_TEL}">${PHONE_DISPLAY}</a>
</div></header>
<main class="wrap ag-wrap">
  <p class="eyebrow">Service agreement</p>
  <h1>The agreement, in full.</h1>
  ${status}
  <p class="ag-meta">Version ${esc(CONTRACT_VERSION)}. Showing: <b>${esc(choice.plan.label)}</b>. The terms are the same for every plan; the price, billing and what's included change with the plan.</p>
  <ul class="ag-plans" aria-label="Other plans">${variantLinks(choice)}</ul>
  <pre class="ag-text">${esc(choice.text)}</pre>
  <p class="ag-meta">Questions about any of it: <a href="mailto:support@minutesregained.com">support@minutesregained.com</a> &middot; <a href="/privacy">Privacy</a></p>
</main>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}

// /start with the chosen plan's agreement already in the panel, and, while
// sign-ups are closed, the sign and pay steps replaced by the hold notice.
export async function startPage(env, request, url) {
  if (url.pathname !== "/start") return Response.redirect(new URL(`/start${url.search}`, url).toString(), 301);
  // The asset is stored as start.html and served at /start (the asset layer
  // redirects the .html spelling), so ask for it by its served path.
  const asset = await env.ASSETS.fetch(new Request(new URL("/start", url), request));
  if (!asset.ok) return asset;
  const choice = agreementChoice(url);
  const open = signupsOpen(env);
  const holdHtml = `<div class="hold">
  <p><b>Taking our first three clients.</b></p>
  <p>Our service agreement is with our attorney right now, and we're not signing anyone until it's back and right. You can read the current draft here. If something in your week is falling through, book the assessment anyway. You'll leave with a written plan either way, and you'll be first in line when the paperwork clears.</p>
  <p><a class="btn btn-primary" href="${BOOK_URL}" target="_blank" rel="noopener">Book a call</a></p>
</div>`;
  let rw = new HTMLRewriter()
    .on("body", { element(el) { el.setAttribute("data-signups", open ? "open" : "closed"); } })
    .on("#contract-box", {
      element(el) {
        el.setInnerContent(choice.text);
        el.setAttribute("aria-busy", "false");
        el.setAttribute("data-key", `${choice.planId}|${choice.billing}|${choice.founding ? 1 : 0}`);
      },
    })
    .on("#agreement-link", { element(el) { el.setAttribute("href", agreementHref(choice)); } })
    .on('input[name="plan"], input[name="billing"]', {
      element(el) {
        const want = el.getAttribute("name") === "plan" ? choice.planId : choice.billing;
        if (el.getAttribute("value") === want) el.setAttribute("checked", "");
        else el.removeAttribute("checked");
      },
    });
  if (!open) {
    rw = rw
      .on("#start-title", { element(el) { el.setInnerContent("Pick a plan and read the agreement."); } })
      .on("#start-hold", { element(el) { el.setInnerContent(holdHtml, { html: true }); el.removeAttribute("hidden"); } })
      .on("#start-lede", { element(el) { el.setInnerContent("Read the plans and the full agreement here. When sign-ups open, your card is handled entirely by Stripe: Minutes Regained never sees or stores it, and never collects payment from, or on behalf of, your customers."); } })
      .on("#step2-title", { element(el) { el.setInnerContent('<span class="step-num">2</span> Read the service agreement', { html: true }); } })
      .on("#to-step2", { element(el) { el.setInnerContent("Read the agreement"); } })
      .on("#agree-form", { element(el) { el.replace(`<div class="hold"><p>${esc(SIGNUPS_CLOSED_MESSAGE)}</p><p><a class="btn btn-primary" href="${BOOK_URL}" target="_blank" rel="noopener">Book a call</a></p></div>`, { html: true }); } })
      .on("#step-pay", { element(el) { el.remove(); } });
  }
  const res = rw.transform(asset);
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}
