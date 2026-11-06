// "Set up a client" on the admin dashboard: one form that creates the
// client's agent, links its plan and owner email, and makes its links
// (customer request form, voice-note link, inbox connect link).
// Links are shown once, on screen; the voice link works like a key.

import { createClientAgent } from "./clientagent.js";
import { createClientLinks } from "./clientpages.js";
import { createConnectInvite } from "./connect.js";
import { PLANS } from "./plans.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, n) => String(v || "").trim().slice(0, n);

export async function setupClient(env, origin, body) {
  const label = clean(body.label, 80), business = clean(body.business, 120) || label;
  const ownerEmail = clean(body.ownerEmail, 160).toLowerCase();
  const slug = clean(body.formSlug, 40).toLowerCase();
  if (!label) return { error: "missing_label" };
  if (!EMAIL_RE.test(ownerEmail)) return { error: "bad_owner_email" };
  if (!PLANS[body.plan]) return { error: "bad_plan", allowed: Object.keys(PLANS) };
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { error: "bad_slug" };
  // Check the form address before creating anything, so a refusal leaves nothing behind.
  const { results: existing } = await env.DB.prepare(`SELECT profile FROM client_agents`).all().catch(() => ({ results: [] }));
  if ((existing || []).some((r) => { try { return JSON.parse(r.profile || "{}").formSlug === slug; } catch { return false; } })) return { error: "slug_taken" };
  const profile = {
    business, trade: clean(body.trade, 60), area: clean(body.area, 120), owner: clean(body.owner, 60),
    signOff: clean(body.signOff, 80) || clean(body.owner, 60), tone: clean(body.tone, 80) || "friendly and plain",
    approvedAnswers: clean(body.approvedAnswers, 4000), emergencyTypes: clean(body.emergencyTypes, 300) || undefined,
  };
  const { id } = await createClientAgent(env, { label, profile });
  const links = await createClientLinks(env, origin, { agentId: id, formSlug: slug, ownerEmail, plan: body.plan, billing: "monthly" });
  if (links.error) return { error: links.error, agentId: id };
  const invite = await createConnectInvite(env, origin, { agentId: id });
  return { ok: true, agentId: id, formUrl: links.formUrl, voiceUrl: links.voiceUrl, connectUrl: invite.url, connectExpires: invite.expires };
}

export function renderSetupPanel(nonce) {
  const plans = Object.entries(PLANS).map(([k, p]) => `<option value="${k}"${k === "business_support" ? " selected" : ""}>${p.label} (${p.hours} hr)</option>`).join("");
  return `
<section class="hours" aria-labelledby="setupTitle">
  <h2 id="setupTitle">Set up a client</h2>
  <form id="f-setup" class="hform setup">
    <div class="sgrid">
      <label>Name on the dashboard<input name="label" required maxlength="80" placeholder="QA Test Co"></label>
      <label>Business name, as customers know it<input name="business" maxlength="120" placeholder="QA Test Plumbing"></label>
      <label>Trade<input name="trade" maxlength="60" placeholder="plumbing"></label>
      <label>Service area<input name="area" maxlength="120" placeholder="Norfolk and Virginia Beach"></label>
      <label>Owner's first name<input name="owner" maxlength="60" placeholder="Jerome"></label>
      <label>Owner's email (drafts, warnings and links go here)<input name="ownerEmail" type="email" required maxlength="160"></label>
      <label>Plan<select name="plan">${plans}</select></label>
      <label>Form address: minutesregained.com/f/<input name="formSlug" required pattern="[a-z0-9-]{3,40}" maxlength="40" placeholder="qa-test-co"></label>
    </div>
    <label>Approved answers, one per line as "Question? Answer"<textarea name="approvedAnswers" rows="4" maxlength="4000" placeholder="Are you licensed? Yes, licensed and insured in Virginia.&#10;Do you work weekends? Saturdays by appointment, no Sundays."></textarea></label>
    <label>What counts as an emergency (optional)<input name="emergencyTypes" maxlength="300" placeholder="burst pipe, no water, sewage backup"></label>
    <p class="note">No prices in approved answers: the agents never quote one. Links are shown once below; the voice link works like a key.</p>
    <button type="submit">Set up client</button>
  </form>
  <div id="setup-out" class="msg" role="status" aria-live="polite" hidden></div>
</section>
<script nonce="${nonce}">
(function () {
  var f = document.getElementById("f-setup"), out = document.getElementById("setup-out");
  f.label.addEventListener("input", function () {
    if (!f.formSlug.dataset.touched) f.formSlug.value = f.label.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  });
  f.formSlug.addEventListener("input", function () { f.formSlug.dataset.touched = "1"; });
  var WHY = { bad_owner_email: "Check the owner's email.", bad_slug: "Form address: 3 to 40 lowercase letters, numbers or dashes.",
    slug_taken: "That form address is taken. Pick another.", missing_label: "Give the client a name." };
  function link(label, url) { var p = document.createElement("p"); p.innerHTML = "<b></b><br><a target='_blank' rel='noopener'></a>"; p.firstChild.textContent = label; var a = p.lastChild; a.href = url; a.textContent = url; return p; }
  f.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var body = {}; new FormData(f).forEach(function (v, k) { body[k] = v; });
    f.querySelector("button").disabled = true;
    fetch("/api/admin/setup-client", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json(); }).then(function (r) {
        f.querySelector("button").disabled = false;
        out.hidden = false; out.textContent = "";
        if (!r.ok) { out.className = "msg bad"; out.textContent = "Not set up: " + (WHY[r.error] || r.error); return; }
        out.className = "msg";
        var h = document.createElement("p"); h.textContent = "Set up (" + r.agentId + "). Copy these now; they aren't shown again. Reload the page to see the client in the panels above."; out.appendChild(h);
        out.appendChild(link("Customer request form (send to customers, or test it yourself)", r.formUrl));
        out.appendChild(link("Voice-note link (owner only)", r.voiceUrl));
        out.appendChild(link("Connect the owner's inbox (expires in " + r.connectExpires + ")", r.connectUrl));
      }).catch(function () { f.querySelector("button").disabled = false; out.hidden = false; out.className = "msg bad"; out.textContent = "Couldn't reach the server."; });
  });
})();
</script>`;
}

export const SETUP_CSS = `
  .setup .sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0 12px}
  .setup textarea{display:block;width:100%;box-sizing:border-box;padding:6px;font:inherit;font-size:.9rem;margin-top:2px}
  #setup-out a{overflow-wrap:anywhere}
`;
