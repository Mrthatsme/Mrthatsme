(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };

  /* The site used to be one long page. Old links like /#pricing go to the page that now holds that section. */
  (function(){
    if(location.pathname !== "/" || !location.hash) return;
    var moved = { "#pricing": "/pricing", "#control": "/services#control", "#admin": "/services#admin",
      "#tools": "/services#tools", "#demo": "/services#demo", "#faq": "/services#faq", "#who": "/about" };
    var to = moved[location.hash];
    if(to) location.replace(to);
  })();

  /* ------------------------------------------------------------------
     FORM ENDPOINT — only used by the bug-report widget below. The
     "Request assessment" form posts to our own /api/leads (the CRM)
     instead; paste a provider URL here only if you want a *second*,
     independent copy of bug reports sent elsewhere.
     ------------------------------------------------------------------ */
  var FORM_ENDPOINT = "/api/feedback";
  var PAGE_LOADED_AT = Date.now(); /* bots submit forms instantly; people take seconds */

  /* the FAQ box searches locally; it must never navigate */
  (function(){ var f=document.getElementById("faq-form");
    if(f) f.addEventListener("submit", function(e){ e.preventDefault(); }); })();
  var CONTACT_EMAIL = "support@minutesregained.com";

  /* ---------- request form ---------- */
  var form = $("signup"), okBox = $("f-ok"), sendBtn = $("f-send");

  function showErr(msg){
    var e = $("f-err");
    if(!e){ e = document.createElement("p"); e.className = "err"; e.id = "f-err"; form.appendChild(e); }
    e.textContent = msg;
  }

  if(form){
    form.addEventListener("submit", function(ev){
      ev.preventDefault();
      var fd = new FormData(form);
      var name = (fd.get("name")||"").toString().trim();
      var biz = (fd.get("biz")||"").toString().trim();
      var contact = (fd.get("contact")||"").toString().trim();
      if(!name || !biz || !contact){ showErr("Please fill in your name, business and email."); return; }
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)){ showErr("Please enter a valid email address so we can reply right away."); return; }
      var phoneVal=(fd.get("phone")||"").toString().trim();
      if(phoneVal && (phoneVal.replace(/\D/g,"").length<10 || phoneVal.replace(/\D/g,"").length>15)){ showErr("That phone number looks incomplete. Include the area code, or leave it blank."); return; }

      sendBtn.disabled = true; sendBtn.textContent = "Sending\u2026";

      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          business: biz,
          contact: contact,
          phone: (fd.get("phone")||"").toString().trim(),
          company_website: (fd.get("company_website")||"").toString(),
          elapsed_ms: Date.now() - PAGE_LOADED_AT,
          contactWindow: (fd.get("window")||"").toString(),
          pain: (fd.get("pain")||"").toString().trim()
        })
      })
        .then(function(r){
          if(!r.ok) throw new Error("bad status");
          form.classList.add("hid");
          okBox.classList.remove("hid");
          /* text nodes only: nothing the visitor typed is ever parsed as markup */
          okBox.textContent = "";
          var okH = document.createElement("h3");
          okH.textContent = "Got it, " + name + ".";
          var okP = document.createElement("p");
          okP.textContent = "We'll be in touch within one business day, in the window you picked.";
          okBox.appendChild(okH); okBox.appendChild(okP);
        })
        .catch(function(){
          sendBtn.disabled = false; sendBtn.textContent = "Request assessment";
          showErr("That didn't send. Email " + CONTACT_EMAIL + " and we'll pick it up the same day.");
        });
    });
  }

  /* ---------- FAQ search: filters the questions already in the page ----------
     Every question and answer is in the HTML as <details class="faq-item">, so
     search engines and no-script readers get all of it. Typing here only hides
     the items that don't match; nothing is built and nothing leaves the browser. */
  (function(){
    var form = $("faq-form"), q = $("faq-q"), meta = $("faq-meta"), none = $("faq-none");
    var items = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));
    if(!form || !q || !items.length) return;
    form.hidden = false;
    var idle = meta ? meta.textContent : "";
    function filter(){
      var f = q.value.toLowerCase().trim(), shown = 0;
      items.forEach(function(el){
        var match = !f || el.textContent.toLowerCase().indexOf(f) >= 0;
        el.hidden = !match;
        if(match) shown++;
        if(f && match && shown <= 2) el.open = true;
      });
      if(none) none.hidden = shown > 0;
      if(meta) meta.textContent = f ? shown + (shown === 1 ? " question matches." : " questions match.") : idle;
    }
    q.addEventListener("input", filter);
    var clr = $("faq-clear");
    if(clr) clr.addEventListener("click", function(){ q.value = ""; filter(); q.focus(); });
  })();

  /* ---------- smooth in-page links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener("click", function(ev){
      var t = document.querySelector(a.getAttribute("href"));
      if(!t) return;
      ev.preventDefault();
      t.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ---------- tester feedback ---------- */
  var fbOpen=$("fb-open"), fbPanel=$("fb-panel"), fbForm=$("fb-form"), fbOk=$("fb-ok"), fbSend=$("fb-send");
  var fbLast=null;
  function fbShow(){ fbLast=document.activeElement; fbPanel.hidden=false; setTimeout(function(){ $("fb-where").focus(); },30); }
  function fbHide(){ fbPanel.hidden=true; if(fbLast&&document.contains(fbLast)){ try{fbLast.focus();}catch(e){} } }
  if(fbOpen){
    fbOpen.addEventListener("click", fbShow);
    $("fb-cancel").addEventListener("click", fbHide);
    fbPanel.addEventListener("click", function(e){ if(e.target===fbPanel) fbHide(); });
    document.addEventListener("keydown", function(e){ if(e.key==="Escape" && !fbPanel.hidden) fbHide(); });

    fbForm.addEventListener("submit", function(ev){
      ev.preventDefault();
      var what=$("fb-what").value.trim();
      if(!what){ $("fb-what").focus(); return; }
      if(!FORM_ENDPOINT){
        $("fb-note").textContent = "Reporting isn't connected yet \u2014 please email this to " + CONTACT_EMAIL + ".";
        return;
      }
      fbSend.disabled=true; fbSend.textContent="Sending\u2026";
      var fd=new FormData();
      fd.append("_subject","SITE BUG REPORT");
      fd.append("type","bug");
      fd.append("where",$("fb-where").value);
      fd.append("what",what);
      fd.append("who",$("fb-who").value.trim());
      fd.append("page",location.pathname+location.hash);
      fd.append("screen",window.innerWidth+"x"+window.innerHeight+" @"+(window.devicePixelRatio||1)+"x");
      fd.append("browser",navigator.userAgent);
      fd.append("theme", window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark":"light");
      fd.append("at",new Date().toISOString());
      fd.append("company_website",$("fb-hp").value);
      fd.append("elapsed_ms",String(Date.now() - PAGE_LOADED_AT));
      fetch(FORM_ENDPOINT,{method:"POST",body:fd,headers:{"Accept":"application/json"}})
        .then(function(r){ if(!r.ok) throw new Error("bad"); 
          fbForm.classList.add("hid"); fbOk.classList.remove("hid");
          fbOk.textContent="";
          var fh=document.createElement("h3"); fh.textContent="Sent. Thank you.";
          var fp=document.createElement("p"); fp.textContent="That goes straight to the fix list.";
          fbOk.appendChild(fh); fbOk.appendChild(fp);
          setTimeout(fbHide,1800);
        })
        .catch(function(){ fbSend.disabled=false; fbSend.textContent="Send report";
          $("fb-note").textContent="That didn't send. Please email it to " + CONTACT_EMAIL + "."; });
    });
  }

  /* ---------- year ---------- */
  var y = $("yr"); if(y) y.textContent = new Date().getFullYear();

  /* ---------- minutes-regained calculator (local only, no network) ---------- */
  (function(){
    var leadsIn = $("calcLeads"), minutesIn = $("calcMinutes"), pctIn = $("calcPct");
    var leadsOut = $("calcLeadsOut"), minutesOut = $("calcMinutesOut"), pctOut = $("calcPctOut");
    var weeklyOut = $("calcWeekly"), annualOut = $("calcAnnual");
    if(!leadsIn || !minutesIn || !pctIn) return;

    var REVIEW_MINUTES_PER_FLAGGED_ITEM = 3; /* "Ask Me" items still need a short human look */

    function fmt(n){ return Math.floor(n).toLocaleString("en-US"); }

    function recalc(){
      var leads = parseInt(leadsIn.value, 10);
      var minutesPerLead = parseInt(minutesIn.value, 10);
      var pctAutomated = parseInt(pctIn.value, 10);

      leadsOut.textContent = leads;
      minutesOut.textContent = minutesPerLead;
      pctOut.textContent = pctAutomated + "%";

      var currentWeeklyMinutes = leads * minutesPerLead;
      var autoCount = Math.round(leads * (pctAutomated / 100));
      var flaggedCount = Math.max(leads - autoCount, 0);
      var afterWeeklyMinutes = flaggedCount * REVIEW_MINUTES_PER_FLAGGED_ITEM;
      var weeklyMinutesRegained = Math.max(currentWeeklyMinutes - afterWeeklyMinutes, 0);
      var annualHoursRegained = (weeklyMinutesRegained * 52) / 60;

      weeklyOut.textContent = fmt(weeklyMinutesRegained);
      annualOut.textContent = fmt(annualHoursRegained);
    }

    [leadsIn, minutesIn, pctIn].forEach(function(input){ input.addEventListener("input", recalc); });
    recalc();
  })();
})();
