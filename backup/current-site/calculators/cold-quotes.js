// Calculator for calculators/cold-quotes.html. External file: the CSP allows no inline scripts.
(function(){
  var $=function(i){var v=parseFloat(document.getElementById(i).value);return isNaN(v)||v<0?0:v};
  var money=function(n){return "$"+Math.round(n).toLocaleString("en-US")};
  var set=function(i,t){document.getElementById(i).textContent=t};
  function run(){ var nf=$("q")*$("nf")/100, jobs=nf*$("win")/100, m=jobs*$("amt");
    set("r_month",money(m));set("r_year",money(m*12));set("r_nf",nf.toFixed(1));set("r_jobs",jobs.toFixed(1)); }
  document.querySelectorAll(".m-calc input").forEach(function(el){el.addEventListener("input",run)});
  run();
})();
