(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  var PLAN_LABELS = { essential: "Essential", business_support: "Business Support" };
  // Sign-ups stay closed until the attorney-reviewed agreement is back; the
  // server removes the sign and pay steps and refuses them if called anyway.
  var signupsOpen = document.body.getAttribute("data-signups") === "open";

  var state = { contractId: null };

  (function preselectPlan() {
    var plan = new URLSearchParams(window.location.search).get("plan");
    if (!plan) return;
    var el = document.querySelector('input[name="plan"][value="' + plan + '"]');
    if (el) el.checked = true;
  })();

  function showStep(id) {
    document.querySelectorAll(".start-step").forEach(function (el) { el.classList.add("hid"); });
    $(id).classList.remove("hid");
  }

  function selectedBilling() {
    var el = document.querySelector('input[name="billing"]:checked');
    return el ? el.value : "monthly";
  }
  function refreshPrices() {
    var b = selectedBilling();
    document.querySelectorAll(".plan-opt .price").forEach(function (el) {
      el.firstChild.nodeValue = el.getAttribute("data-" + b);
      el.querySelector("small").textContent = b === "retainer" ? "/yr" : "/mo";
    });
  }
  document.querySelectorAll('input[name="billing"]').forEach(function (el) {
    el.addEventListener("change", function () { refreshPrices(); refreshFoundingRow(); });
  });

  function selectedPlan() {
    var el = document.querySelector('input[name="plan"]:checked');
    return el ? el.value : "business_support";
  }

  // ---------- founding-offer availability ----------
  function refreshFoundingRow() {
    var row = $("founding-row");
    // The founding offer is monthly billing only.
    if (selectedPlan() !== "business_support" || selectedBilling() !== "monthly") {
      row.classList.add("hid"); $("founding-check").checked = false; return;
    }
    fetch("/api/founding-status")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.available) {
          row.classList.remove("hid");
          $("founding-remaining").textContent = "(" + d.remaining + " of 3 spots left)";
        } else {
          row.classList.add("hid");
          $("founding-check").checked = false;
        }
      })
      .catch(function () { row.classList.add("hid"); });
  }
  document.querySelectorAll('input[name="plan"]').forEach(function (el) {
    el.addEventListener("change", refreshFoundingRow);
  });
  refreshFoundingRow();

  // ---------- agreement gate: no agreeing to terms that never loaded ----------
  var gate = { loaded: false, read: false };
  function refreshGate() {
    var box = $("contract-box"), chk = $("agree-check");
    if (!chk) return;
    var ready = gate.loaded && gate.read;
    chk.disabled = !ready;
    if (!ready) chk.checked = false;
    $("agree-lock").textContent = !gate.loaded ? "You can tick this once the agreement has loaded."
      : !gate.read ? "Scroll to the end of the agreement to continue." : "";
    $("to-step3").disabled = !(ready && chk.checked);
  }
  function markRead() {
    var box = $("contract-box");
    gate.read = box.scrollHeight <= box.clientHeight + 4 ||
      box.scrollTop + box.clientHeight >= box.scrollHeight - 24;
    refreshGate();
  }
  $("contract-box").addEventListener("scroll", markRead, { passive: true });
  if ($("agree-check")) $("agree-check").addEventListener("change", refreshGate);
  window.addEventListener("resize", function () { if (gate.loaded) markRead(); });
  function termsFailed() {
    gate.loaded = false; gate.read = false;
    $("contract-box").classList.add("hid");
    $("terms-error").classList.remove("hid");
    refreshGate();
  }

  // ---------- step 1 -> 2 ----------
  // The server puts the chosen plan's agreement into the page before it
  // loads, so the panel is never empty. Picking another plan fetches that
  // plan's text, with a time limit and a link to the plain page if it fails.
  function agreementQuery(plan, founding, billing) {
    var p = new URLSearchParams({ plan: plan, billing: billing });
    if (founding) p.set("founding", "1");
    return p.toString();
  }
  function setAgreementLinks(q) {
    ["agreement-link", "terms-error-link"].forEach(function (id) { if ($(id)) $(id).setAttribute("href", "/agreement?" + q); });
  }
  function loadAgreement() {
    var plan = selectedPlan();
    var founding = $("founding-check").checked && plan === "business_support";
    var billing = selectedBilling();
    var key = plan + "|" + billing + "|" + (founding ? 1 : 0);
    var box = $("contract-box");
    var serverText = box.getAttribute("data-key") === key;
    setAgreementLinks(agreementQuery(plan, founding, billing));
    gate.loaded = false; gate.read = false; refreshGate();
    $("terms-error").classList.add("hid");
    box.classList.remove("hid");
    state.plan = plan; state.founding = founding; state.billing = billing;
    showStep("step-contract");

    if (serverText) {
      // Already in the page from the server: nothing to wait for.
      box.setAttribute("aria-busy", "false");
      gate.loaded = true;
      markRead();
      return;
    }
    box.setAttribute("aria-busy", "true");
    box.textContent = "Loading the agreement for this plan…";
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    fetch("/api/contract-text?" + new URLSearchParams({ plan: plan, founding: founding ? "1" : "0", billing: billing }).toString(), ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        if (d.error || !d.text || d.text.length < 400) { termsFailed(); return; }
        box.textContent = d.text;
        box.setAttribute("data-key", key);
        box.setAttribute("aria-busy", "false");
        box.scrollTop = 0;
        gate.loaded = true;
        markRead();
      })
      .catch(function () { clearTimeout(timer); termsFailed(); });
  }
  $("to-step2").addEventListener("click", loadAgreement);
  $("terms-retry").addEventListener("click", loadAgreement);

  // ---------- step 2: agree ----------
  if (signupsOpen && $("agree-form")) $("agree-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var errEl = $("agree-err");
    errEl.textContent = "";

    if (!$("agree-check").checked) {
      errEl.textContent = "Please check the box confirming you agree to the terms above.";
      return;
    }
    var business = $("a-business").value.trim();
    var name = $("a-name").value.trim();
    var email = $("a-email").value.trim();
    if (!business || !name || !email) {
      errEl.textContent = "Please fill in all fields.";
      return;
    }

    var btn = $("to-step3");
    btn.disabled = true;
    btn.textContent = "Submitting…";

    fetch("/api/agree", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: state.plan,
        founding: !!state.founding,
        billing: state.billing || "monthly",
        signerName: name,
        signerEmail: email,
        businessName: business,
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        btn.textContent = "Continue to payment";
        refreshGate();
        if (!res.ok) {
          if (res.d.error === "founding_offer_full") {
            errEl.textContent = "The Founding Client offer just filled up. Please uncheck it and continue at the standard price, or contact us.";
          } else {
            errEl.textContent = "Something went wrong recording your agreement. Please try again.";
          }
          return;
        }
        state.contractId = res.d.contractId;
        showStep("step-pay");
      })
      .catch(function () {
        btn.textContent = "Continue to payment";
        refreshGate();
        errEl.textContent = "Something went wrong. Please check your connection and try again.";
      });
  });

  // ---------- step 3: stripe handoff ----------
  if (signupsOpen && $("to-stripe")) $("to-stripe").addEventListener("click", function () {
    var btn = $("to-stripe");
    var errEl = $("pay-err");
    errEl.textContent = "";
    btn.disabled = true;
    btn.textContent = "Redirecting…";

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: state.contractId }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.url) {
          btn.disabled = false;
          btn.textContent = "Continue to Stripe";
          errEl.textContent = "Could not start checkout. Please try again, or email support@minutesregained.com.";
          return;
        }
        window.location.href = res.d.url;
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Continue to Stripe";
        errEl.textContent = "Could not start checkout. Please try again, or email support@minutesregained.com.";
      });
  });

  // ---------- return from Stripe ----------
  (function handleReturn() {
    var params = new URLSearchParams(window.location.search);
    var status = params.get("status");
    if (!status) return;

    showStep("step-result");
    var box = $("result-box");
    if (status === "success") {
      box.className = "ok";
      box.innerHTML = "<h2>You're set up.</h2><p>Payment confirmed and your service agreement is on file. We'll be in touch within one business day to start your assessment and onboarding.</p>";
    } else {
      box.className = "err";
      box.innerHTML = "<h2>Checkout canceled.</h2><p>No charge was made. You can start over any time from the pricing section, or email support@minutesregained.com if something went wrong.</p>";
    }
  })();
})();
