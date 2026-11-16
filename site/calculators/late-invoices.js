// Calculator for calculators/late-invoices.html. External file: the CSP allows no inline scripts.
(function(){
  var $=function(i){var v=parseFloat(document.getElementById(i).value);return isNaN(v)||v<0?0:v};
  var money=function(n){return "$"+Math.round(n).toLocaleString("en-US")};
  var set=function(i,t){document.getElementById(i).textContent=t};
  function run(){ var out=$("n")*$("avg")*$("late")/100*($("days")/30), hrs=$("hrs")*52/12, m=hrs*$("rate");
    set("r_month",money(m));set("r_year",money(m*12));set("r_out",money(out));set("r_hrs",hrs.toFixed(1)); }
  document.querySelectorAll(".m-calc input").forEach(function(el){el.addEventListener("input",run)});
  run();
})();
