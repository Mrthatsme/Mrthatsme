// Permission levels on the admin dashboard: one card per client, a level for
// each kind of email (only the levels its ceiling allows), and the Never list
// of senders the AI never reads. Saves through POST /api/admin/levels.

import { escapeHtml as e } from "./admin.js";
import { CATEGORIES, LEVELS, effectiveLevel, validateLevels } from "./levels.js";

export async function saveLevels(env, { agentId, levels, neverFrom, stepUp }) {
  const agent = await env.DB.prepare(`SELECT * FROM client_agents WHERE id = ?`).bind(agentId).first();
  if (!agent) return { error: "agent_not_found" };
  const v = validateLevels({ levels, neverFrom });
  if (v.error) return v;
  const profile = JSON.parse(agent.profile || "{}");
  profile.levels = { ...(profile.levels || {}), ...v.levels };
  profile.neverFrom = v.neverFrom;
  // Second look on Sonnet (clientagent.js). Only changed when the form sends it.
  if (typeof stepUp === "boolean") profile.stepUp = stepUp;
  await env.DB.prepare(`UPDATE client_agents SET profile = ? WHERE id = ?`).bind(JSON.stringify(profile), agentId).run();
  return { ok: true, levels: Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, effectiveLevel(profile, c)])), neverFrom: profile.neverFrom, stepUp: profile.stepUp === true };
}

export async function dashboardLevels(env) {
  const { results } = await env.DB.prepare(`SELECT id, label, profile FROM client_agents WHERE status = 'active' ORDER BY label`).all()
    .catch(() => ({ results: [] }));
  return (results || []).map((a) => {
    const p = JSON.parse(a.profile || "{}");
    return { id: a.id, label: a.label, stepUp: p.stepUp === true, neverFrom: [].concat(p.neverFrom || []), levels: Object.fromEntries(Object.keys(CATEGORIES).map((c) => [c, effectiveLevel(p, c)])) };
  });
}

export function renderLevelsPanel(clients, nonce) {
  if (!clients.length) return "";
  const card = (c) => `
    <form class="hform lvform" data-agent="${e(c.id)}">
      <h3>${e(c.label)}</h3>
      ${Object.entries(CATEGORIES).map(([id, cat]) => {
        const allowed = LEVELS.slice(0, LEVELS.indexOf(cat.max) + 1);
        return `<label>${e(cat.label)}${cat.why ? ` <small>(${e(cat.why)})</small>` : ""}
          <select name="${id}"${allowed.length === 1 ? " disabled" : ""}>${allowed.map((l) => `<option${l === c.levels[id] ? " selected" : ""}>${l}</option>`).join("")}</select></label>`;
      }).join("")}
      <label>Never send to the AI: emails from these senders, one per line (an address, or @domain.com for everyone there)
        <textarea name="neverFrom" rows="3" placeholder="lawyer@smithlaw.com&#10;@mybank.com">${e(c.neverFrom.join("\n"))}</textarea></label>
      <label><input type="checkbox" name="stepUp"${c.stepUp ? " checked" : ""}> Second look on Sonnet for long threads, drafts with 2+ blanks, and repeat customers (up to 5 a day, about 1.5 cents each)</label>
      <p class="note">Ask Me: a draft waits for the owner. Tell Me: emergencies go to the on-call person, then the owner is told. Handle It: mail that isn't from a customer is set aside. Until approved replies are switched on, Handle It and Tell Me on a reply still leave a draft.</p>
      <button type="submit">Save levels</button>
    </form>`;
  return `
<section class="hours" aria-labelledby="lvTitle">
  <h2 id="lvTitle">Permission levels</h2>
  <p id="lvmsg" class="msg" role="status" aria-live="polite" hidden></p>
  <div class="forms">${clients.map(card).join("")}</div>
</section>
<script nonce="${nonce}">
(function () {
  var msg = document.getElementById("lvmsg");
  function show(t, bad) { msg.textContent = t; msg.hidden = false; msg.className = bad ? "msg bad" : "msg"; msg.scrollIntoView({ block: "nearest" }); }
  document.querySelectorAll("form.lvform").forEach(function (f) {
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var levels = {};
      f.querySelectorAll("select:not([disabled])").forEach(function (s) { levels[s.name] = s.value; });
      var never = f.neverFrom.value.split("\\n").map(function (x) { return x.trim(); }).filter(Boolean);
      f.querySelector("button").disabled = true;
      fetch("/api/admin/levels", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ agentId: f.dataset.agent, levels: levels, neverFrom: never, stepUp: f.stepUp.checked }) })
        .then(function (r) { return r.json(); }).then(function (r) {
          f.querySelector("button").disabled = false;
          if (r.ok) return show("Saved for " + f.querySelector("h3").textContent + ".");
          show("Not saved: " + (r.message || (r.error === "bad_never_from" ? "check the sender " + r.value : r.error)), true);
        }).catch(function () { f.querySelector("button").disabled = false; show("Couldn't reach the server.", true); });
    });
  });
})();
</script>`;
}
