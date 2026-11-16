/* Homepage: the "what is the office work costing you" calculator.
   Runs in the browser only; nothing typed here is sent anywhere.
   The pricing numbers live in CALC below so they can change in one place. */
(function () {
  "use strict";
  var CALC = {
    recovered: 0.6,          // share of the hours assumed to come back (an estimate, not a client result)
    weeksPerMonth: 4.333,
    // The plan suggested for a given monthly value of the hours that come back, highest first.
    plans: [
      { atLeast: 4000, name: "Custom Automation, whole back office", price: 2100 },
      { atLeast: 2600, name: "Business Support", price: 1300 },
      { atLeast: 0,    name: "Custom Automation, one gap", price: 550 }
    ]
  };
  var $ = function (id) { return document.getElementById(id); };
  var hrs = $("hrs"), ppl = $("ppl"), rate = $("rate");
  var mo = $("calc-mo"), yr = $("calc-yr"), vs = $("calc-vs");
  if (!hrs || !ppl || !rate || !mo || !yr || !vs) return;

  function usd(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function clamp(v, lo, hi, dflt) { v = Number(v); if (!isFinite(v)) v = dflt; return Math.max(lo, Math.min(hi, v)); }

  function b(t) { var e = document.createElement("b"); e.textContent = t; return e; }
  function calc() {
    var h = clamp(hrs.value, 0, 80, 0), n = clamp(ppl.value, 1, 50, 1), r = clamp(rate.value, 0, 1000, 0);
    var monthly = r * h * n * CALC.weeksPerMonth;
    var recoveredHours = h * n * CALC.recovered;
    var saved = r * recoveredHours * CALC.weeksPerMonth;
    mo.textContent = usd(monthly);
    yr.textContent = usd(monthly * 12);
    vs.textContent = "";
    if (saved < 1) { vs.textContent = "Put your own numbers in and the plans below have something to beat."; return; }
    var plan = CALC.plans[CALC.plans.length - 1];
    for (var i = 0; i < CALC.plans.length; i++) if (saved >= CALC.plans[i].atLeast) { plan = CALC.plans[i]; break; }
    if (plan.price > saved) {
      vs.append("Automating that gives back about ", b((Math.round(recoveredHours * 10) / 10) + " hours a week"), ", worth ", b(usd(saved)),
        " a month. At these numbers a plan costs more than the hours are worth. Tell us about it on the free assessment call; sometimes the fix is smaller than a plan.");
      return;
    }
    var pct = Math.round(plan.price / saved * 100);
    vs.append("Automating that gives back about ", b((Math.round(recoveredHours * 10) / 10) + " hours a week"),
      ", worth ", b(usd(saved)), " a month. The plan that fits, " + plan.name + ", costs ", b(usd(plan.price)),
      ", or ", b(pct + "%"), " of what you get back.");
  }
  [hrs, ppl, rate].forEach(function (el) { el.addEventListener("input", calc); });
  calc();
})();
