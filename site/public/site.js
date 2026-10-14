(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };

  /* ------------------------------------------------------------------
     FORM ENDPOINT — only used by the bug-report widget below. The
     "Request assessment" form posts to our own /api/leads (the CRM)
     instead; paste a provider URL here only if you want a *second*,
     independent copy of bug reports sent elsewhere.
     ------------------------------------------------------------------ */
  var FORM_ENDPOINT = "";

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
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)){ showErr("Please enter a valid email address so we can reply right away."); return; }

      sendBtn.disabled = true; sendBtn.textContent = "Sending\u2026";

      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          business: biz,
          contact: contact,
          phone: (fd.get("phone")||"").toString().trim(),
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

  /* ---------- searchable FAQ (no model, no network) ---------- */
  var FAQ = [
    ["Do you need my password?",
     "No, and we refuse it if offered. Every system you use can grant access without handing over the account \u2014 Gmail calls it \u201Cgrant access to your account.\u201D You grant it, and you can take it back yourself in about four seconds. Your two-factor never leaves your phone."],
    ["Can it spend my money or run a card?",
     "No. Never. Not at any setting and not if you ask. There is no banking credential, no payment login and no transfer tool anywhere in the system. When a card needs charging, you are told and you charge it. Every chargeback and refund stays yours, because we were never near it."],
    ["Can it send quotes or emails without asking me?",
     "Anything new reaching one of your customers waits for you. One exception, written into the agreement: a holding reply that says we have your message and someone is looking at it. It commits you to no price, no date and no promise \u2014 it exists because silence is what loses the customer."],
    ["What are the four control levels?",
     "Handle it \u2014 do it, don't ask. Tell me \u2014 do it, then report. Ask me \u2014 draft it and wait. Never \u2014 not possible, because no tool exists behind it. You set them per kind of work and change them whenever you like."],
    ["What happens when the internet is down?",
     "We commit to one business day, not an uptime percentage \u2014 anyone promising four nines on a service like this is quoting a number they can't be held to. Nothing arriving is lost: your calls, voicemail, email and forms queue with the carriers. And an outage can't produce a wrong action, only a late one, because nothing consequential sends without a person releasing it."],
    ["I can only talk at certain times. Does that work?",
     "That's the normal case, not the exception. You set the days, hours and channel you can be reached, and routine items collect into one digest inside that window instead of pinging all day. A short written list is allowed to break it \u2014 a customer cancelling, a filing deadline inside two business days, a no-show, a vendor decision that would cost you, or a supply you need for a booked job. That list is in the agreement, not left to judgment."],
    ["What stops someone running up your costs \u2014 or mine?",
     "Your bill can't move. It's a flat monthly retainer with no usage meter and no overage line, so nobody else's behaviour becomes a charge to you. Each client also runs under its own ceiling, so one busy month can't degrade anyone else."],
    ["Is my information mixed in with other clients?",
     "No. Each client's data sits in its own space and there is no path from one to another. Your information is used to do your work. It is not pooled and it is not used to train anything."],
    ["What if someone tries to trick it?",
     "They will \u2014 it's the first thing we planned for. Emails, attachments and web pages are treated as information, never as instructions. And the part that matters more: the dangerous actions have no tool behind them. A convincing email asking us to redirect a payment can't succeed, because nothing in the system can move a payment."],
    ["How long does setup take?",
     "About an hour, once. Granting access, walking through how you actually work, and setting the levels. Then the first two weeks run read-only while you watch \u2014 it drafts everything and sends nothing."],
    ["How big does my business need to be?",
     "Roughly one to twenty-five people. The fit is situation more than headcount: you need help and you are not ready to hire another full-time person. Industry doesn't matter."],
    ["Do you work with my industry?",
     "Almost certainly. Industry doesn't matter — trades, cleaning, photographers, designers, studios and shops all fit. What matters is the situation: roughly one to twenty-five people, more admin than you can keep up with, and not ready to hire another full-time person."],
    ["Can it handle my Instagram or Facebook messages?",
     "Not today. We work through your email, your website forms, your calendar and your CRM. Social media DMs and posting aren't part of the service right now, so nothing we set up will message anyone on Instagram or Facebook."],
    ["What happens if I stop?",
     "You revoke access from inside your own accounts \u2014 you don't have to ask us or wait for us. Within five business days you get written confirmation that no access and no copy of your data remains, beyond what tax and business records require. Nothing is held hostage."],
    ["What if it gets something wrong?",
     "It will, eventually. That's the entire reason the levels exist \u2014 the work with real consequences waits for you, so a mistake shows up as a bad draft you decline rather than a bad email your customer receives. Start everything at ask-me and loosen it as you see the judgment."],
    ["Is there a contract?",
     "Yes, a short service agreement you sign online. Monthly plans need 30 days' notice to cancel; a 12-month Retainer saves 10%. Pricing is published rather than quoted on a call, there's no setup fee, and software we use to serve you is included up to your plan's allowance."],
    ["What do you actually do?",
     "We find the repetitive work eating your week, like missed calls, quote follow-ups, reminders and invoices, then build automations to handle it. Our agents run them daily and fix anything that breaks. Building your first automations is included. No setup fee."],
    ["What happens if an automation breaks?",
     "We monitor every automation we build, and we fix breaks at no charge, usually within one business day and often before you notice. Repairs never use your hours."],
    ["If I cancel, do I lose the automations?",
     "No. They live in your own accounts and keep running. We just stop monitoring and maintaining them."],
    ["How many hours do I get?",
     "Every plan includes a set number of support hours: 10, 22 or 40, used for new builds and hands-on admin. We count each task at the time a skilled assistant would take (for example, 5 minutes to schedule an appointment), and you get a monthly report showing every task. We never bill extra hours without asking first."],
    ["Is software included?",
     "Yes. The tools we use to serve you are included in your plan, up to an allowance. Your own existing subscriptions, like your email or accounting software, stay yours."],
    ["Can I cancel?",
     "Monthly plans: 30 days' notice, anytime. Retainers: 12 months at 10% off. Leave early and you only repay the discount you received. The first month covers setup and isn't refundable once setup begins."],
    ["Who does the work?",
     "AI agents do the work, set up and supervised by a person, and nothing important goes out without your approval level."]
  ];

  var list = $("faq-list"), q = $("faq-q"), meta = $("faq-meta");

  function draw(filter){
    if(!list) return;
    list.innerHTML = "";
    var f = (filter||"").toLowerCase().trim();
    var shown = 0;
    FAQ.forEach(function(item, i){
      var hay = (item[0] + " " + item[1]).toLowerCase();
      if(f && hay.indexOf(f) < 0) return;
      shown++;
      var d = document.createElement("details");
      d.className = "faq-item";
      if(f && shown <= 2) d.open = true;
      var sm = document.createElement("summary");
      sm.textContent = item[0];
      var p = document.createElement("p");
      p.textContent = item[1];
      d.appendChild(sm); d.appendChild(p);
      list.appendChild(d);
    });
    if(!shown){
      var n = document.createElement("p");
      n.className = "note";
      n.textContent = "Nothing matches that. Use the form below and a person will answer it.";
      list.appendChild(n);
    }
    if(meta) meta.textContent = f
      ? shown + (shown === 1 ? " question matches." : " questions match.")
      : "Nothing you type here leaves your browser.";
  }

  if(q){
    q.addEventListener("input", function(){ draw(q.value); });
    var clr = $("faq-clear");
    if(clr) clr.addEventListener("click", function(){ q.value = ""; draw(""); q.focus(); });
  }
  draw("");

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

    function fmt(n){ return Math.round(n).toLocaleString("en-US"); }

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
