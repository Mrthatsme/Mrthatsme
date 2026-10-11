(function () {
  "use strict";

  // Mobile nav toggle
  var navToggle = document.getElementById("navToggle");
  var nav = document.getElementById("nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Minutes Regained calculator (same formula used across the demo agent and
  // the Opportunity Map one-pager: manual-minutes baseline minus what's still
  // needed for the share that gets flagged for human review).
  var leadsInput = document.getElementById("calcLeads");
  var minutesInput = document.getElementById("calcMinutes");
  var pctInput = document.getElementById("calcPct");
  var leadsOut = document.getElementById("calcLeadsOut");
  var minutesOut = document.getElementById("calcMinutesOut");
  var pctOut = document.getElementById("calcPctOut");
  var weeklyOut = document.getElementById("calcWeekly");
  var annualOut = document.getElementById("calcAnnual");

  var REVIEW_MINUTES_PER_FLAGGED_ITEM = 3;

  function formatNumber(n) {
    return Math.round(n).toLocaleString("en-US");
  }

  function recalc() {
    var leads = parseInt(leadsInput.value, 10);
    var minutesPerLead = parseInt(minutesInput.value, 10);
    var pctAutomated = parseInt(pctInput.value, 10);

    leadsOut.textContent = leads;
    minutesOut.textContent = minutesPerLead;
    pctOut.textContent = pctAutomated + "%";

    var currentWeeklyMinutes = leads * minutesPerLead;
    var autoCount = Math.round(leads * (pctAutomated / 100));
    var flaggedCount = Math.max(leads - autoCount, 0);
    var afterWeeklyMinutes = flaggedCount * REVIEW_MINUTES_PER_FLAGGED_ITEM;
    var weeklyMinutesRegained = Math.max(currentWeeklyMinutes - afterWeeklyMinutes, 0);
    var annualHoursRegained = (weeklyMinutesRegained * 52) / 60;

    weeklyOut.textContent = formatNumber(weeklyMinutesRegained);
    annualOut.textContent = formatNumber(annualHoursRegained);
  }

  [leadsInput, minutesInput, pctInput].forEach(function (input) {
    if (input) input.addEventListener("input", recalc);
  });

  if (leadsInput) recalc();
})();
