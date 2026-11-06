// The GM panel on the admin dashboard: questions the agents couldn't answer,
// client by client, most-asked first. Answer once and the GM hands that
// answer to every agent from then on. Prices are refused (gm.js).

import { escapeHtml as e } from "./admin.js";

export function renderGmPanel(clients, nonce) {
  if (!clients.length) {
    return `<section class="hours"><h2>The GM</h2><p id="gmmsg" class="msg" role="status" hidden></p><p class="empty">No open questions. When an agent can't answer something,
      the GM lists it here for you to answer once.</p></section>
<script nonce="${nonce}">try { var t = sessionStorage.getItem("gmMsg"); if (t) { sessionStorage.removeItem("gmMsg"); var m = document.getElementById("gmmsg"); m.textContent = t; m.hidden = false; } } catch (e) {}</script>`;
  }
  const cards = clients.map((c) => `
    <article class="hcard">
      <h3>${e(c.label)} <small>${c.gaps.length} open</small></h3>
      ${c.gaps.map((g) => `
      <form class="gmform hform" data-agent="${e(c.id)}" data-gap="${g.id}">
        <p class="gq"><b>"${e(g.question)}"</b><br><small>${g.times > 1 ? `Asked ${g.times} times` : "Asked once"}, from ${e(g.asked_by)}</small></p>
        <label>Approved answer<input name="answer" maxlength="600" required placeholder="Yes, we cover Chesapeake and Virginia Beach."></label>
        <p class="note">Plain facts only. No prices, no dates, no promises: those stay with the owner.</p>
        <button type="submit">Save answer</button>
        <button type="button" class="dismiss">Doesn't need an answer</button>
      </form>`).join("")}
    </article>`).join("");
  return `
<section class="hours" aria-labelledby="gmTitle">
  <h2 id="gmTitle">The GM: questions the agents couldn't answer</h2>
  <p id="gmmsg" class="msg" role="status" aria-live="polite" hidden></p>
  <div class="hgrid">${cards}</div>
</section>
<script nonce="${nonce}">
(function () {
  var msg = document.getElementById("gmmsg");
  function show(t, bad) { msg.textContent = t; msg.hidden = false; msg.className = bad ? "msg bad" : "msg"; }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json(); });
  }
  function done(t) { try { sessionStorage.setItem("gmMsg", t); } catch (e) {} location.reload(); }
  try { var kept = sessionStorage.getItem("gmMsg"); if (kept) { sessionStorage.removeItem("gmMsg"); show(kept); } } catch (e) {}
  document.querySelectorAll("form.gmform").forEach(function (f) {
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      post("/api/admin/gm-answer", { agentId: f.dataset.agent, gapId: +f.dataset.gap, answer: f.answer.value.trim() }).then(function (r) {
        if (r.ok) return done("Saved. The GM will hand that answer to every agent" + (r.closedGaps > 1 ? ", and it closed " + r.closedGaps + " matching questions." : "."));
        show(r.message || "Not saved: " + r.error, true);
      }).catch(function () { show("Couldn't reach the server.", true); });
    });
    f.querySelector(".dismiss").addEventListener("click", function () {
      post("/api/admin/gm-dismiss", { agentId: f.dataset.agent, gapId: +f.dataset.gap }).then(function (r) {
        if (r.ok) return done("Dismissed.");
        show("Not dismissed: " + r.error, true);
      }).catch(function () { show("Couldn't reach the server.", true); });
    });
  });
})();
</script>`;
}
