// The Hours panel on the admin dashboard: where each client's month stands,
// and forms for the GM's hours ledger (hours.js). Every form posts to the
// existing /api/admin/* calls, so the same rules apply: time past the
// client's hours plus approved extra is refused, and warnings email the client.
//
// The page's one script runs under a per-request nonce (see worker.js).

import { escapeHtml } from "./admin.js";
import { fmtMinutes, KINDS } from "./hours.js";

const e = escapeHtml;

function clientCard(c) {
  const open = c.builds.filter((b) => b.status === "open");
  const done = c.builds.filter((b) => b.status !== "open");
  const flag = open.some((b) => b.short) ? `<span class="flag">Heading past hours</span>` : "";
  const builds = open.map((b) => `
      <li><b>${e(b.name)}</b>${b.includedCustom ? ' <span class="tag">included custom</span>' : ""}<br>
        ${fmtMinutes(b.logged)} logged${b.estimate ? ` of ~${fmtMinutes(b.estimate)}` : ", no estimate"}
        ${b.short ? `<span class="flag">${fmtMinutes(b.short)} short, client asked for OK</span>` : ""}
        <button type="button" class="finish" data-build="${e(b.id)}" data-name="${e(b.name)}">Mark finished</button></li>`).join("");
  const finished = done.map((b) => `<li>${e(b.name)}: ${fmtMinutes(b.total || 0)} total${b.extra ? `, ${fmtMinutes(b.extra)} extra` : ""}</li>`).join("");
  return `
    <article class="hcard">
      <h3>${e(c.label)} <small>${e(c.plan)} &middot; ${e(c.month)}</small> ${flag}</h3>
      <div class="nums">
        <div><span>Used</span><b>${fmtMinutes(c.used)}</b></div>
        <div><span>Available</span><b>${fmtMinutes(c.available)}</b></div>
        <div><span>Left, incl. approved extra</span><b>${fmtMinutes(c.headroom)}</b></div>
        <div><span>Extra used</span><b>${c.extraUsed ? fmtMinutes(c.extraUsed) : "None"}</b></div>
      </div>
      <p class="sub">${fmtMinutes(c.planMinutes)} plan${c.carry ? ` + ${fmtMinutes(c.carry)} rolled over` : ""}${c.approved ? ` + ${fmtMinutes(c.approved)} extra approved` : ""}.
        <a href="/api/admin/hours?agentId=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Monthly report</a></p>
      ${open.length ? `<p class="lbl">Open builds</p><ul>${builds}</ul>` : ""}
      ${done.length ? `<p class="lbl">Finished</p><ul class="done">${finished}</ul>` : ""}
    </article>`;
}

export function renderHoursPanel(clients, nonce) {
  const options = clients.map((c) => `<option value="${e(c.id)}">${e(c.label)}</option>`).join("");
  const today = new Date().toISOString().slice(0, 10);
  const data = JSON.stringify(clients.map((c) => ({ id: c.id, builds: c.builds.filter((b) => b.status === "open").map((b) => ({ id: b.id, name: b.name })) })))
    .replace(/</g, "\\u003c");
  if (!clients.length) {
    return `<section class="hours"><h2>Hours</h2><p>No active client with plan hours yet. Link a client's plan with
      <code>POST /api/admin/client-links</code> (clientId or plan) and they'll show here.</p></section>`;
  }
  return `
<section class="hours" aria-labelledby="hoursTitle">
  <h2 id="hoursTitle">Hours</h2>
  <p id="hmsg" class="msg" role="status" aria-live="polite" hidden></p>
  <div class="hgrid">${clients.map(clientCard).join("")}</div>

  <div class="forms">
    <form id="f-log" class="hform">
      <h3>Log time</h3>
      <label>Client<select name="agentId" class="client" required>${options}</select></label>
      <label>Build (optional)<select name="buildId" class="build"><option value="">Not a build</option></select></label>
      <label>Kind<select name="kind">${KINDS.map((k) => `<option${k === "admin" ? " selected" : ""}>${k}</option>`).join("")}</select></label>
      <label>Task<input name="task" maxlength="200" required placeholder="Rescheduled Tuesday's jobs after the van broke down"></label>
      <div class="row">
        <label>Hours<input name="h" type="number" min="0" max="8" step="1" value="0" inputmode="numeric"></label>
        <label>Minutes<input name="m" type="number" min="0" max="59" step="1" value="15" inputmode="numeric"></label>
        <label>Date<input name="workDate" type="date" value="${today}"></label>
      </div>
      <p class="quick">Quick: <button type="button" data-min="5">5 min</button><button type="button" data-min="15">15</button><button type="button" data-min="30">30</button><button type="button" data-min="60">1 hr</button></p>
      <p class="note">Count the time a skilled assistant would take, not the clock. Only this month can be logged.</p>
      <button type="submit">Log time</button>
    </form>

    <form id="f-build" class="hform">
      <h3>Open a build</h3>
      <label>Client<select name="agentId" required>${options}</select></label>
      <label>Name<input name="name" maxlength="120" required placeholder="Warranty reminders"></label>
      <label>Estimate, hours<input name="est" type="number" min="0.25" max="200" step="0.25" inputmode="decimal" placeholder="6"></label>
      <label class="check"><input name="includedCustom" type="checkbox"> The custom automation included with Business Support</label>
      <p class="note">If the estimate won't fit in the hours left, the client is emailed and asked for their OK straight away.</p>
      <button type="submit">Open build</button>
    </form>

    <form id="f-ok" class="hform">
      <h3>Record the client's OK for extra time</h3>
      <label>Client<select name="agentId" required>${options}</select></label>
      <label>Extra hours approved<input name="hrs" type="number" min="0.25" max="100" step="0.25" required inputmode="decimal"></label>
      <label>Where it came from<input name="note" maxlength="400" minlength="10" required placeholder="Email from Dana, Nov 12: OK up to 2 more hours"></label>
      <p class="note">Only record an OK the client gave in writing. Quote it.</p>
      <button type="submit">Record OK</button>
    </form>
  </div>
</section>
<script type="application/json" id="hours-data">${data}</script>
<script nonce="${nonce}">
(function () {
  var data = JSON.parse(document.getElementById("hours-data").textContent);
  var msg = document.getElementById("hmsg");
  function show(text, bad) { msg.textContent = text; msg.hidden = false; msg.className = bad ? "msg bad" : "msg"; msg.scrollIntoView({ block: "nearest" }); }
  try { var kept = sessionStorage.getItem("hoursMsg"); if (kept) { sessionStorage.removeItem("hoursMsg"); show(kept); } } catch (e) {}
  function done(text) { try { sessionStorage.setItem("hoursMsg", text); } catch (e) {} location.reload(); }
  function fmt(m) { var h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + " hr " + r + " min" : h + " hr") : r + " min"; }
  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }
  var WHY = {
    included_custom_is_business_support_only: "Only a Business Support client has an included custom build.",
    included_custom_already_exists: "This client already has its included custom build. Open this one without the tick.",
    no_plan_hours: "This client has no plan with hours linked yet.",
    build_is_done: "That build is already finished.",
    build_not_found: "That build doesn't exist for this client.",
    work_date_must_be_this_month: "Only this month's time can be logged.",
    note_must_quote_the_written_ok: "Say where the OK came from, quoting it (at least 10 characters).",
    minutes_must_be_1_to_480: "One entry can be 1 minute to 8 hours.",
    estimate_must_be_whole_minutes: "Check the estimate.",
    missing_task: "Say what the task was.",
    missing_name: "Give the build a name."
  };
  function why(body) { return WHY[body.error] || body.message || body.error; }
  function busy(form, on) { var b = form.querySelector("button[type=submit]"); if (b) b.disabled = on; }

  var log = document.getElementById("f-log");
  var client = log.querySelector(".client"), build = log.querySelector(".build");
  function fillBuilds() {
    var c = data.find(function (x) { return x.id === client.value; });
    build.innerHTML = '<option value="">Not a build</option>';
    (c ? c.builds : []).forEach(function (b) { var o = document.createElement("option"); o.value = b.id; o.textContent = b.name; build.appendChild(o); });
  }
  client.addEventListener("change", fillBuilds); fillBuilds();
  build.addEventListener("change", function () { if (build.value && log.kind.value === "admin") log.kind.value = "build"; });
  log.querySelectorAll(".quick button").forEach(function (b) {
    b.addEventListener("click", function () { var m = +b.dataset.min; log.h.value = Math.floor(m / 60); log.m.value = m % 60; });
  });
  log.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var minutes = (+log.h.value || 0) * 60 + (+log.m.value || 0);
    if (minutes < 1) return show("Enter some time first.", true);
    busy(log, true);
    post("/api/admin/hours", { agentId: client.value, buildId: build.value || undefined, kind: log.kind.value,
      task: log.task.value.trim(), minutes: minutes, workDate: log.workDate.value })
      .then(function (r) {
        busy(log, false);
        if (r.body.ok) {
          var w = (r.body.warnings || []).length ? " A build is still heading past the client's hours: waiting on their written OK (they get one email per shortfall)." : "";
          return done("Logged " + fmt(minutes) + ". " + fmt(r.body.status.headroom) + " left this month." + w);
        }
        if (r.body.error === "needs_client_ok") return show("Not logged: only " + fmt(r.body.minutesLeft) + " left this month, including approved extra. The client has been emailed and the work is paused until they give their OK in writing.", true);
        show("Not logged: " + why(r.body), true);
      }).catch(function () { busy(log, false); show("Couldn't reach the server. Nothing was logged.", true); });
  });

  var bf = document.getElementById("f-build");
  bf.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var est = bf.est.value ? Math.round(+bf.est.value * 60) : undefined;
    busy(bf, true);
    post("/api/admin/builds", { agentId: bf.agentId.value, name: bf.name.value.trim(), estimateMinutes: est, includedCustom: bf.includedCustom.checked })
      .then(function (r) {
        busy(bf, false);
        if (r.body.build) return done("Build opened." + (r.body.projection && r.body.projection.short ? " The estimate is " + fmt(r.body.projection.short) + " past the hours left, so the client has been emailed for their OK." : ""));
        show("Not opened: " + why(r.body), true);
      }).catch(function () { busy(bf, false); show("Couldn't reach the server.", true); });
  });

  var ok = document.getElementById("f-ok");
  ok.addEventListener("submit", function (ev) {
    ev.preventDefault();
    busy(ok, true);
    post("/api/admin/hours-approval", { agentId: ok.agentId.value, minutes: Math.round(+ok.hrs.value * 60), note: ok.note.value.trim() })
      .then(function (r) {
        busy(ok, false);
        if (r.body.ok) return done("OK recorded. " + fmt(r.body.status.headroom) + " now available this month.");
        show("Not recorded: " + why(r.body), true);
      }).catch(function () { busy(ok, false); show("Couldn't reach the server.", true); });
  });

  document.querySelectorAll("button.finish").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!confirm("Mark " + b.dataset.name + " finished? The client is emailed the total time, and nothing more can be logged to it.")) return;
      b.disabled = true;
      post("/api/admin/builds/done", { buildId: b.dataset.build }).then(function (r) {
        if (r.body.ok) return done(b.dataset.name + " finished: " + fmt(r.body.totalMinutes) + " total" + (r.body.extraMinutes ? ", " + fmt(r.body.extraMinutes) + " extra ($" + (r.body.extraCents / 100).toFixed(2) + " to bill)." : ", all within plan hours."));
        b.disabled = false; show("Not finished: " + why(r.body), true);
      }).catch(function () { b.disabled = false; show("Couldn't reach the server.", true); });
    });
  });
})();
</script>`;
}

export const HOURS_CSS = `
  .hours{background:#fff;border:1px solid #ddd;padding:1rem;margin-top:1.5rem}
  .hours h2{margin-top:0}
  .hgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .hcard{border:1px solid #e3e0cf;padding:12px;background:#fffef6}
  .hcard h3{margin:0 0 8px;font-size:1rem} .hcard small{font-weight:400;color:#666}
  .nums{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
  .nums div{background:#f4f4ea;padding:6px 8px} .nums span{display:block;font-size:.75rem;color:#555} .nums b{font-family:ui-monospace,monospace}
  .sub{font-size:.8rem;color:#555;margin:8px 0}
  .lbl{font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#555;margin:10px 0 4px}
  .hcard ul{margin:0;padding-left:1.1rem;font-size:.85rem} .hcard li{margin-bottom:6px}
  .flag{display:inline-block;background:#fde2c8;color:#8a3b00;font-size:.72rem;padding:1px 6px;margin-left:4px}
  .tag{font-size:.72rem;color:#1e2bfa}
  button.finish{display:block;margin-top:4px;font-size:.78rem}
  .forms{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:16px}
  .hform{border:1px solid #e3e0cf;padding:12px;background:#fff}
  .hform h3{margin:0 0 8px;font-size:1rem}
  .hform label{display:block;font-size:.8rem;color:#333;margin-bottom:8px}
  .hform input,.hform select{display:block;width:100%;box-sizing:border-box;padding:6px;font:inherit;font-size:.9rem;margin-top:2px}
  .hform .check{display:flex;gap:6px;align-items:flex-start} .hform .check input{width:auto;margin-top:2px}
  .hform .row{display:grid;grid-template-columns:1fr 1fr 1.6fr;gap:8px}
  .hform .note{font-size:.75rem;color:#666;margin:4px 0 8px}
  .quick{font-size:.78rem;margin:0 0 6px} .quick button{margin-left:4px;font-size:.78rem}
  .hform button[type=submit]{background:#1e2bfa;color:#fff;border:0;padding:8px 14px;font:inherit;cursor:pointer}
  .hform button[disabled]{opacity:.5}
  .msg{padding:8px 10px;background:#e3f4e1;border-left:3px solid #2e7d32;font-size:.9rem}
  .msg.bad{background:#fde2c8;border-left-color:#8a3b00}
  @media (max-width:600px){ body{margin:1rem !important} .hgrid,.forms{grid-template-columns:1fr} }
`;
export const GM_CSS = `
  .gmform{margin-top:8px} .gq{margin:0 0 6px;font-size:.88rem}
  .gmform .dismiss{margin-left:8px;font-size:.8rem;background:none;border:0;color:#555;text-decoration:underline;cursor:pointer}
`;
