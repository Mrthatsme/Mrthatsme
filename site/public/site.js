(function(){
  "use strict";
  var $ = function(id){ return document.getElementById(id); };

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

  /* ---------- searchable FAQ (no model, no network) ---------- */
  var FAQ = [
    ["Do you need my password?",
     "No. You don't hand us your passwords, and there's nothing to install on your computer or phone. You add us the way you'd add a new employee: Gmail calls it \u201Cgrant access,\u201D and Google Calendar, your Google listing, Jobber, Housecall Pro, QuickBooks and Square each have a team or user page. You choose what we can see and remove us yourself in seconds. The one exception, and only if you choose it: if one of your tools has no way to add a user, you can share that one login through 1Password, from your own vault or into a vault we keep for you alone that you can see and empty at any time. A person uses it, never the automated system. We never accept a bank, card or payroll login, or the login to your main email account, and you change any shared password when we part ways. The steps are at minutesregained.com/access."],
    ["Can it spend my money or run a card?",
     "No. Never. Not at any setting and not if you ask. There is no banking credential, no payment login and no transfer tool anywhere in the system. When a card needs charging, you are told and you charge it. Every chargeback and refund stays yours, because we were never near it."],
    ["Can it send quotes or emails without asking me?",
     "Quotes, prices and anything new always wait for your OK. Today everything that goes to your customers is drafted for you to check and send, apart from a short \u201cwe got your message\u201d note so nobody waits in silence. During onboarding you can also approve a short set of replies, in your own words, that go out on their own, and only to people who contacted you first."],
    ["What are the four control levels?",
     "Handle it \u2014 do it, don't ask. Tell me \u2014 do it, then report. Ask me \u2014 draft it and wait. Never \u2014 not possible, because no tool exists behind it. You set them per kind of work and change them whenever you like."],
    ["What happens when the internet is down?",
     "We commit to one business day, not an uptime percentage \u2014 anyone promising four nines on a service like this is quoting a number they can't be held to. Nothing arriving is lost: your calls, voicemail, email and forms queue with the carriers. And an outage can't produce a wrong action, only a late one, because nothing consequential sends without a person releasing it."],
    ["I can only talk at certain times. Does that work?",
     "That's the normal case, not the exception. You set the days, hours and channel you can be reached, and routine items collect into one digest inside that window instead of pinging all day. A short written list is allowed to break it \u2014 a customer cancelling, a filing deadline inside two business days, a no-show, a vendor decision that would cost you, or a supply you need for a booked job. That list is in the agreement, not left to judgment."],
    ["What about emergencies after hours, like a burst pipe?",
     "You tell us what counts as an emergency for your business and who is on call when, and the promise you make, such as a tech within two hours. When one comes in, your on-call person gets the name, address, callback number and the problem right away, and so do you. Outside your business hours, the customer also gets a short automatic note from your assistant saying the team has been alerted; during your hours that note waits in your drafts. Any arrival time goes out only with your OK. We check your inbox every ten minutes, so it reaches your tech within minutes, not the next morning."],
    ["Can bots or spam run up costs on my website?",
     "No. The question box on your site answers from your approved answers with no AI behind it, so a bot asking a thousand questions costs nothing. Contact forms screen out bots with a hidden trap field, a too-fast check and a limit per sender, and every block is counted in your daily brief. Your bill is flat either way."],
    ["What stops someone running up your costs \u2014 or mine?",
     "Your monthly fee is flat. The one thing that can add to it is your own voice notes past your plan's monthly allowance, at $10 for each extra 100, and you're emailed at 80% and again when you go over. Bots, spam and other clients can't become a charge to you. Each client also runs under its own ceiling, so one busy month can't degrade anyone else."],
    ["Which AI do you use, and what can it see?",
     "Drafts are written by Claude, from Anthropic. For each draft it sees the one message being answered and your approved wording, and Anthropic does not train on it. Voice notes are turned into text by Cloudflare. To connect Gmail we ask Google for permission to read and organize your mail and save drafts; Google's name for that permission also covers sending, but our system has no send function and never sends from your mailbox. On Microsoft we ask only to read and write mail, not to send. The full list is on our privacy page."],
    ["Is my information mixed in with other clients?",
     "No. Each client has its own email connection, its own assistant and its own records, and every lookup our system makes is limited to the one client it is working for. Your access is stored encrypted and separately from anyone else's. Your information is used to do your work. It is not pooled and it is not used to train anything."],
    ["What if someone tries to trick it?",
     "They will \u2014 it's the first thing we planned for. Emails, attachments and web pages are treated as information, never as instructions. And the part that matters more: the dangerous actions have no tool behind them. A convincing email asking us to redirect a payment can't succeed, because nothing in the system can move a payment."],
    ["How long does setup take?",
     "About an hour, once. Granting access, walking through how you actually work, and setting the levels. Then the first two weeks run read-only while you watch \u2014 it drafts everything and sends nothing. The trial is part of your first month, not an extra charge."],
    ["How big does my business need to be?",
     "Roughly one to twenty-five people. The fit is situation more than headcount: you need help and you are not ready to hire another full-time person. Industry doesn't matter."],
    ["Do you work with my industry?",
     "Yes. Every small business runs on the same back office: an inbox, a calendar, quotes, invoices and follow-ups. If it's work you'd hand to an assistant, it fits, whether you run a crew, an office, a studio or a shop. Your free assessment is where we learn how your business actually works, everything is set to your rules before anything runs, and anything that needs your professional judgment, like pricing or legal advice, always stays with you."],
    ["Do you text my customers?",
     "No, never. We reply only where the customer reached out, like your website chat or email, and Facebook and Instagram once those are connected. Missed calls go to the top of your daily brief so you can call back."],
    ["Can it handle my Instagram or Facebook messages?",
     "Coming soon. We're adding replies in your Facebook and Instagram inboxes, in words you approve, only to people who messaged you first. Until then we work through your email, website forms and chat, calendar and CRM. We never send text messages."],
    ["What happens if I stop?",
     "You revoke access from inside your own accounts \u2014 you don't have to ask us or wait for us. Within five business days you get written confirmation that no access and no copy of your data remains, beyond what tax and business records require. Nothing is held hostage."],
    ["What if it gets something wrong?",
     "It will, eventually. That's the entire reason the levels exist \u2014 the work with real consequences waits for you, so a mistake shows up as a bad draft you decline rather than a bad email your customer receives. Start everything at ask-me and loosen it as you see the judgment."],
    ["Is there a contract?",
     "Yes, a short service agreement you sign online. Monthly plans need 30 days' notice to cancel; a 12-month Retainer, paid upfront for the year, saves 10%. Pricing is published rather than quoted on a call, there's no setup fee, and software we use to serve you is included up to your plan's allowance."],
    ["What do you actually do?",
     "We build and run five core automations: Lead Catcher (website chat and lead replies), Quote Chaser (follow-ups on open quotes), Schedule Keeper (confirmations, reminders and no-shows), Review Builder (one review request when a job closes) and Invoice & Chase (invoices sent and unpaid ones followed up; we never take the money), plus your Daily Brief. On top of that we keep your inbox, follow-ups and calendar current. We fix anything that breaks. No setup fee."],
    ["What happens if an automation breaks?",
     "We monitor every automation we build, and we fix breaks at no charge, usually within one business day and often before you notice. Repairs never use your hours."],
    ["If I cancel, do I lose the automations?",
     "No. They live in your own accounts and keep running. We just stop monitoring and maintaining them."],
    ["How many hours do I get?",
     "Essential includes 4 hours a month and Business Support 8 hours of a person's time: building new automations, and one-off admin you hand us, like rescheduling a week of jobs or cleaning up your contact list. Automations you've approved never use your hours, however often they run, and neither do monitoring, repairs or your daily brief. Each hands-on task is counted at the time a skilled assistant would take (for example, 5 minutes to schedule an appointment), and your monthly report lists every one. Unused hours roll over one month. Extra hours are $75 an hour on either plan, and we never bill them without asking first."],
    ["Is software included?",
     "Yes. The tools we use to serve you are included in your plan, up to an allowance. We never bill you for software above it: if a tool you'd need costs more, we tell you first and you decide. Your own existing subscriptions, like your email or accounting software, stay yours."],
    ["Can I cancel?",
     "Essential and Business Support: cancel any time with 30 days' notice. A 12-month Retainer is paid upfront at 10% off; leave early and we refund the rest of the year, keeping only the 10% discount on the months you used. Custom Automation has a 12-month term, because the build happens in the first month, and is monthly after that. On every plan, the first month covers the build and isn't refundable once building begins."],
    ["Who does the work?",
     "Both, and here's the split. Automations do the routine work you've approved, every day, and never use your hours. A person, the owner of Minutes Regained, sets up your account, does the hands-on admin your hours pay for, fixes anything that breaks, and answers your emails. Nothing important goes out without the approval level you set."]
  ];

  var list = $("faq-list"), q = $("faq-q"), meta = $("faq-meta");
  // With no search, show the six questions owners ask first; the rest are one tap away.
  var TOP = ["What do you actually do?", "How many hours do I get?", "Who does the work?",
    "Can it send quotes or emails without asking me?", "Do you need my password?", "Can I cancel?"];
  var showAll = false;

  function draw(filter){
    if(!list) return;
    list.innerHTML = "";
    var f = (filter||"").toLowerCase().trim();
    var shown = 0;
    var items = (f || showAll) ? FAQ : TOP.map(function(t){
      for(var i = 0; i < FAQ.length; i++) if(FAQ[i][0] === t) return FAQ[i];
    }).filter(Boolean);
    items.forEach(function(item, i){
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
    if(!f && !showAll){
      var more = document.createElement("button");
      more.type = "button";
      more.className = "btn btn--line btn-sm faq-more";
      more.textContent = "Show all " + FAQ.length + " questions";
      more.addEventListener("click", function(){ showAll = true; draw(""); });
      list.appendChild(more);
    }
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
