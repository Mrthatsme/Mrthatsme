// Intake form for a client's social media link (/f/<slug>). Posts JSON to
// /api/intake/<slug>; the hidden field and fill time screen out bots.
(function () {
  var form = document.getElementById("intake");
  if (!form) return;
  var started = Date.now();
  var status = document.getElementById("f-status");
  var messages = {
    missing_fields: "Please add your name and what you need.",
    need_phone_or_email: "Please give a phone number or an email so they can reach you.",
    invalid_email: "That email address doesn't look right.",
    invalid_phone: "That phone number doesn't look right.",
    too_many_requests: "Too many requests just now. Please try again in a few minutes."
  };
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = form.querySelector("button");
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    data.src = form.getAttribute("data-src") || "";
    data.elapsed_ms = Date.now() - started;
    btn.disabled = true;
    status.className = "status";
    status.textContent = "Sending…";
    fetch("/api/intake/" + encodeURIComponent(form.getAttribute("data-slug")), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
      .then(function (res) {
        if (res.ok) {
          form.innerHTML = '<h1>Thanks, we have your request.</h1><p>We’ll be in touch as soon as we can.</p>';
          return;
        }
        status.className = "status err";
        status.textContent = messages[res.b && res.b.error] || "Something went wrong. Please try again.";
        btn.disabled = false;
      })
      .catch(function () {
        status.className = "status err";
        status.textContent = "Couldn't send. Check your connection and try again.";
        btn.disabled = false;
      });
  });
})();
