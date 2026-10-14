(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  var PLAN_LABELS = { essential: "Essential", business_support: "Business Support", operations_plus: "Operations+" };

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
    });
  }
  document.querySelectorAll('input[name="billing"]').forEach(function (el) {
    el.addEventListener("change", refreshPrices);
  });

  function selectedPlan() {
    var el = document.querySelector('input[name="plan"]:checked');
    return el ? el.value : "business_support";
  }

  // ---------- founding-offer availability ----------
  function refreshFoundingRow() {
    var row = $("founding-row");
    if (selectedPlan() !== "business_support") { row.classList.add("hid"); return; }
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

  // ---------- step 1 -> 2 ----------
  $("to-step2").addEventListener("click", function () {
    var plan = selectedPlan();
    var founding = $("founding-check").checked && plan === "business_support";
    $("contract-box").textContent = "Loading…";
    showStep("step-contract");

    var billing = selectedBilling();
    var params = new URLSearchParams({ plan: plan, founding: founding ? "1" : "0", billing: billing });
    fetch("/api/contract-text?" + params.toString())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) { $("contract-box").textContent = "Could not load the agreement. Please refresh and try again."; return; }
        $("contract-box").textContent = d.text;
        state.plan = plan;
        state.founding = founding;
        state.billing = billing;
        state.planLabel = d.plan.label;
        state.priceCents = d.plan.priceCents;
      })
      .catch(function () { $("contract-box").textContent = "Could not load the agreement. Please refresh and try again."; });
  });

  // ---------- step 2: agree ----------
  $("agree-form").addEventListener("submit", function (ev) {
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
        btn.disabled = false;
        btn.textContent = "Continue to payment";
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
        btn.disabled = false;
        btn.textContent = "Continue to payment";
        errEl.textContent = "Something went wrong. Please check your connection and try again.";
      });
  });

  // ---------- step 3: stripe handoff ----------
  $("to-stripe").addEventListener("click", function () {
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
