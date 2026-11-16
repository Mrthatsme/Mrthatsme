// Calculator for calculators/slow-replies.html. External file: the CSP allows no inline scripts.
(function(){
  var $=function(i){var v=parseFloat(document.getElementById(i).value);return isNaN(v)||v<0?0:v};
  var money=function(n){return "$"+Math.round(n).toLocaleString("en-US")};
  var set=function(i,t){document.getElementById(i).textContent=t};
  function run(){ var lost=$("inq")*$("late")/100*$("gone")/100, jobs=lost*$("close")/100, m=jobs*$("job");
    set("r_month",money(m));set("r_year",money(m*12));set("r_leads",lost.toFixed(1));set("r_jobs",jobs.toFixed(1)); }
  document.querySelectorAll(".m-calc input").forEach(function(el){el.addEventListener("input",run)});
  run();
})();
