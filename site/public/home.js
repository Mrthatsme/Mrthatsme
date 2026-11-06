/* Homepage: the live lead demo and the five-automation board. No network calls. */
/* ---------- the live screen: one lead, handled, for the chosen trade ---------- */
(function () {
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var TRADES = [
    { id: 'home', label: 'Home services', biz: 'Northside Plumbing', cust: 'Dana R.', channel: 'Website chat', time: '7:12 PM',
      them: "Water's coming out from under my kitchen sink. I shut the valve. Can anyone come tonight?",
      us: "We got it, Dana. This sounds urgent, so we've sent it straight to our on-call tech. If you don't hear back in 15 minutes, call our emergency line. — Northside Plumbing",
      route: ['Marked urgent', 'Sent to the on-call tech'], hot: true, reply: '1:48' },
    { id: 'law', label: 'Law office', biz: 'Coastline Law Group', cust: 'Sam P.', channel: 'Website chat', time: '6:47 PM',
      them: 'I was in a car accident last week. Can I talk to someone about my options?',
      us: "Hi Sam, thanks for reaching out to Coastline Law Group. We can't give legal advice in this chat, but we got your message and our office will reach out by tomorrow at noon to set up a consultation. You can also pick a time here: [booking link]",
      route: ['Intake summary sent to the attorney', 'Consultation link sent'], hot: false, reply: '2:10' },
    { id: 'salon', label: 'Salon', biz: 'Studio Nine', cust: 'Mia L.', channel: 'Website chat', time: '8:05 PM',
      them: 'Do you have anything open Saturday for a cut and color?',
      us: "Hi Mia, thanks for messaging Studio Nine. We got your message about a cut and color, and you'll hear back first thing tomorrow. You can also see open times here: [booking link]",
      route: ['Booking link sent', 'Saturday request flagged for you'], hot: false, reply: '0:52' },
    { id: 'photo', label: 'Photographer', biz: 'Golden Hour Photo', cust: 'Tom W.', channel: 'Website chat', time: '12:31 PM',
      them: "Are you free October 10 next year for a wedding? About 120 guests. What do packages cost?",
      us: "Hi Tom, congratulations! Thanks for reaching out to Golden Hour Photo. We got your message about your wedding date, and you'll hear back by the end of the day with availability and package details.",
      route: ['Date and pricing question sent to you', 'Inquiry saved with the date'], hot: false, reply: '1:35' },
    { id: 'cleaning', label: 'Cleaning', biz: 'Bright Day Cleaning', cust: 'Alicia M.', channel: 'Website chat', time: '9:18 AM',
      them: 'Hi, looking for a move-out clean on the 28th. 3 bed 2 bath.',
      us: "Hi Alicia, thanks for reaching out to Bright Day Cleaning. We got your message about a move-out clean, and you'll hear back within 2 business hours.",
      route: ['Date request sent to you', 'Inquiry saved'], hot: false, reply: '1:12' },
    { id: 'realestate', label: 'Real estate', biz: 'Harbor Home Group', cust: 'James K.', channel: 'Website chat', time: '2:30 PM',
      them: 'Is the house on Oak Street still available? Could we see it Saturday?',
      us: "Hi James, thanks for reaching out to Harbor Home Group. We got your message about the Oak Street listing, and you'll hear back within the hour. You can also pick a showing time here: [booking link]",
      route: ['Showing link sent', 'Agent notified'], hot: false, reply: '0:58' }
  ];
  var STEPS = [
    ['Message caught', function (t) { return t.channel + ' · ' + t.time; }],
    ['Lead saved to your CRM', function (t) { return t.cust + ' · ' + t.label.toLowerCase(); }],
    ['Approved reply sent', function (t) { return 'Your wording · ' + t.reply + ' after it came in'; }],
    [function (t) { return t.route[0]; }, function (t) { return t.route[1]; }],
    ['Follow-ups lined up', function () { return 'Day 1, 3 and 7 by email, waiting for your OK'; }],
    ["In your next brief", function () { return 'Your brief lands at 6:00 PM each day'; }]
  ];

  var $ = function (id) { return document.getElementById(id); };
  var list = $('tradeList'), stepsEl = $('stSteps'), fill = $('stFill');
  var timers = [], raf = null, cur = 0, chosen = false, visible = true, cycling = null;

  TRADES.forEach(function (t, i) {
    var li = document.createElement('li');
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'trade'; b.textContent = t.label; b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.addEventListener('click', function () { chosen = true; play(i); });
    li.appendChild(b); list.appendChild(li);
  });

  STEPS.forEach(function (s, i) {
    var li = document.createElement('li');
    li.className = 'step';
    li.innerHTML = '<span class="step__dot">' + (i + 1) + '</span><span><span class="step__t"></span><span class="step__d"></span></span><span class="step__at"></span>';
    stepsEl.appendChild(li);
  });
  var stepEls = [].slice.call(stepsEl.children);

  function val(v, t) { return typeof v === 'function' ? v(t) : v; }
  function clear() { timers.forEach(clearTimeout); timers = []; if (raf) cancelAnimationFrame(raf); raf = null; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function secs(s) { var p = s.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function mmss(n) { n = Math.round(n); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }

  function paint(t, upto) {
    $('stBiz').textContent = t.biz;
    $('stClock').textContent = t.time;
    $('stCust').textContent = t.cust;
    $('stChannel').textContent = t.channel;
    $('bThem').textContent = t.them;
    $('bUs').innerHTML = '';
    $('bUs').appendChild(document.createTextNode(t.us));
    var sm = document.createElement('small'); sm.textContent = 'Sent ' + t.reply + ' later · approved wording'; $('bUs').appendChild(sm);
    stepEls.forEach(function (el, i) {
      el.querySelector('.step__t').textContent = val(STEPS[i][0], t);
      el.querySelector('.step__d').textContent = val(STEPS[i][1], t);
      el.querySelector('.step__at').textContent = i === 0 ? '0:00' : i === 2 ? t.reply : '';
      el.classList.toggle('on', i < upto);
      el.classList.toggle('hot', i === 3 && t.hot);
    });
    fill.style.height = (upto <= 1 ? 0 : (upto - 1) / (STEPS.length - 1) * 100) + '%';
    $('mSteps').textContent = upto;
    $('mYou').textContent = upto >= 5 ? '1' : '0';
    $('stSummary').textContent = 'Example for ' + t.label + ': ' + t.cust + ' writes "' + t.them + '" The approved reply goes out ' + t.reply + ' later, the lead is saved, ' + t.route[0].toLowerCase() + ', follow-ups are set and it shows up in your next daily brief. One thing waits for you: OK the follow-ups.';
  }

  function settle(t) {
    paint(t, STEPS.length);
    $('bThem').classList.add('in'); $('bUs').classList.add('in'); $('bTyping').classList.remove('on');
    $('mReply').textContent = t.reply;
  }

  function play(i) {
    clear();
    cur = i;
    var t = TRADES[i];
    [].forEach.call(list.querySelectorAll('.trade'), function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    if (reduce) { settle(t); return; }
    paint(t, 0);
    $('bThem').classList.remove('in'); $('bUs').classList.remove('in'); $('bTyping').classList.remove('on');
    $('mReply').textContent = '0:00';
    var target = secs(t.reply);
    later(function () { $('bThem').classList.add('in'); }, 250);
    later(function () { paint(t, 1); }, 900);
    later(function () { paint(t, 2); $('bTyping').classList.add('on'); count(target, 1900); }, 1700);
    later(function () { $('bTyping').classList.remove('on'); $('bUs').classList.add('in'); paint(t, 3); $('mReply').textContent = t.reply; }, 3700);
    later(function () { paint(t, 4); }, 4600);
    later(function () { paint(t, 5); }, 5400);
    later(function () { paint(t, 6); }, 6200);
    later(function () { if (!chosen && visible) play((cur + 1) % TRADES.length); }, 12500);
  }

  function count(target, dur) {
    var t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      $('mReply').textContent = mmss(target * p);
      if (p < 1) raf = requestAnimationFrame(step); else raf = null;
    }
    raf = requestAnimationFrame(step);
  }

  $('replay').addEventListener('click', function () { chosen = true; play(cur); });

  // Complete at rest: the first frame shows the finished run, then it plays.
  settle(TRADES[0]);
  if (!reduce) {
    var started = false;
    var go = function () { if (!started) { started = true; setTimeout(function () { play(0); }, 900); } };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) go();
      }, { threshold: 0.35 }).observe(document.querySelector('.screen'));
    } else { go(); }
  }
})();

/* ---------- the five automations ---------- */
(function () {
  var AUTOS = [
    { name: 'Lead Catcher', status: ['setup', 'Built during onboarding · Facebook & Instagram later'], short: 'Website chat answered in minutes',
      sum: 'Every message in your website chat gets a reply in minutes, from your approved answers. Facebook and Instagram inboxes are next. The lead lands in a simple CRM, and anything urgent goes straight to whoever is on call. Missed calls are logged at the top of your brief so you can call back.',
      strip: [['0:00', 'Message comes in', true], ['Minutes', 'Approved reply'], ['Day 1', 'Check-in'], ['Day 3', 'Email check-in'], ['Day 7', 'Last email check-in']],
      quote: "Hi {name}, thanks for messaging {your business}. We got your message about {service}, and you'll hear back {reply window}. If it's easier, you can pick a time here: {booking link}",
      trigger: 'A new message in your website chat', stops: 'The customer replies or books, or after the third check-in. Later check-ins go by email, only if they gave one', you: 'Every reply, anything urgent, and any question about price or timing' },
    { name: 'Quote Chaser', status: ['setup', 'Built during onboarding · follow-ups wait for your OK'], short: 'Follow-ups on every open quote',
      sum: 'You send the quote. We line up email follow-ups for day 2, 5 and 10 so it never goes quiet. Each one waits for your OK until you approve it to go on its own. It never changes, discounts or explains a price.',
      strip: [['Day 0', 'You send the quote', true], ['Day 2', 'Came through OK?'], ['Day 5', 'Want a call?'], ['Day 10', 'Last check-in']],
      quote: 'Hi {name}, following up on your quote for {job}. Happy to walk through it with you. Would you like {owner} to give you a call?',
      trigger: 'You mark a quote as sent', stops: 'The customer replies, accepts, declines or books', you: 'Every reply, especially anything about price or scope' },
    { name: 'Schedule Keeper', status: ['setup', 'Built during onboarding · reminders wait for your OK'], short: 'Confirmations, reminders and no-show follow-up',
      sum: 'Confirmations the day before, reminders the morning of, and a follow-up on anyone who no-shows. Reschedules get handled from your real open times without a phone call. Emergencies go straight to whoever is on call.',
      strip: [['Booked', 'Confirmation'], ['Day before', 'Reminder'], ['Morning of', 'Reminder'], ['After', 'No-show follow-up']],
      quote: 'Reminder: {your business} is scheduled for tomorrow, {day}, arriving {window}. Need to change it? Pick a new time here: {reschedule link}',
      trigger: 'An appointment is created or changed on your calendar', stops: 'The appointment happens or is cancelled', you: 'A reschedule with no open slot, a cancellation, any job-day question' },
    { name: 'Review Builder', status: ['setup', 'Built during onboarding'], short: 'One review request when a job closes',
      sum: 'The day a job closes out, the customer gets asked for a review. One ask, politely worded, never a second one. The brief shows you who left one.',
      strip: [['Job done', 'You mark it complete', true], ['Same day', 'One review request'], ['Next brief', 'Who left one']],
      quote: "Thanks for choosing {your business}, {name}. If you have a minute, a quick review helps a small business like ours a lot: {review link}. And if anything wasn't right, just reply to this email.",
      trigger: 'A job is marked complete', stops: 'After the one ask', you: 'Every reply, and anything that sounds like a complaint' },
    { name: 'Invoice & Chase', status: ['setup', 'Built during onboarding'], short: 'Invoices sent, unpaid ones followed up',
      sum: "The invoice goes out from your own invoicing tool when the job closes, and the unpaid ones get chased on a schedule so nobody is doing it at 10pm. You see who's paid and who hasn't. We send and we follow up. We never take the money. When something needs collecting, you collect it.",
      strip: [['Job closes', 'Invoice sent', true], ['Your schedule', 'Reminders on unpaid ones'], ['Every brief', "Who's paid, who hasn't"]],
      quote: 'Hi {name}, a quick reminder that invoice {number} from {your business} for {amount} is still open. You can pay it here: {your payment link}. Reply to this email with any questions.',
      trigger: 'A job closes in your job or invoicing tool', stops: 'The invoice is paid, or a reply comes in', you: 'Every reply, any dispute, and anything that needs collecting' },
    { name: 'The Daily Brief', extra: true, status: ['live', 'Ready now · included with every plan'], short: 'One summary with only your decisions',
      sum: 'Your inbox sorted, replies drafted, voice notes from the truck turned into job notes, and one brief that lists what got handled and the few things that need you.',
      strip: [['All day', 'Inbox sorted, replies drafted'], ['As you go', 'Voice notes to job notes'], ['6:00 PM', 'Your brief lands', true]],
      quote: 'NEEDS YOU: Missed call at 2:14, call back. NEEDS YOU: Quote ready for the Johnson job. DONE: Website chat answered, lead saved. DONE: Day-5 follow-up sent on 2 open quotes. Automations: 5 of 5 running.',
      trigger: 'Every day, morning, evening or both', stops: 'Never. It is your daily summary', you: 'Only the decisions that are yours' }
  ];
  var tabs = document.getElementById('tabs'), panel = document.getElementById('panel');
  var btns = AUTOS.map(function (a, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab'); b.id = 'tab' + i;
    b.setAttribute('aria-controls', 'panel');
    b.innerHTML = '<span class="tab__n">' + (a.extra ? '+' : '0' + (i + 1)) + '</span><span><b></b><span></span><em></em></span>';
    b.querySelector('b').textContent = a.name;
    b.querySelector('span span').textContent = a.short;
    b.querySelector('em').textContent = a.status[0] === 'live' ? 'Ready now' : 'Built during onboarding';
    b.addEventListener('click', function () { show(i); });
    b.addEventListener('keydown', function (e) {
      var k = e.key, n = null;
      if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % AUTOS.length;
      if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i + AUTOS.length - 1) % AUTOS.length;
      if (n !== null) { e.preventDefault(); show(n); btns[n].focus(); }
    });
    tabs.appendChild(b);
    return b;
  });
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function show(i) {
    var a = AUTOS[i];
    btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
    panel.setAttribute('aria-labelledby', 'tab' + i);
    panel.innerHTML = '';
    var head = el('div'); head.style.display = 'grid'; head.style.gap = '0.6rem'; head.style.justifyItems = 'start';
    head.appendChild(el('p', 'eyebrow', a.extra ? 'Included with every plan' : 'Automation ' + (i + 1) + ' of 5'));
    head.appendChild(el('h3', 'display', a.name));
    head.appendChild(el('span', 'chip-status ' + a.status[0], a.status[1]));
    head.appendChild(el('p', 'panel__sum', a.sum));
    panel.appendChild(head);
    var strip = el('div', 'strip');
    strip.appendChild(el('span', 'strip__label', 'When it runs'));
    strip.appendChild(el('div', 'strip__track'));
    var ol = el('ol'); ol.style.gridTemplateColumns = 'repeat(' + a.strip.length + ', minmax(0, 1fr))';
    a.strip.forEach(function (s) {
      var li = el('li', s[2] ? 'you' : '');
      li.appendChild(el('i')); li.appendChild(el('b', null, s[0])); li.appendChild(el('span', null, s[1]));
      ol.appendChild(li);
    });
    strip.appendChild(ol);
    panel.appendChild(strip);
    var q = el('div', 'quote');
    q.appendChild(el('span', null, i === 4 ? 'What your brief says' : 'The message, in words you approve'));
    q.appendChild(el('p', null, a.quote));
    panel.appendChild(q);
    var dl = el('dl', 'facts');
    [['Starts when', a.trigger], ['Stops when', a.stops], ['Comes to you', a.you]].forEach(function (f) {
      var d = el('div'); d.appendChild(el('dt', null, f[0])); d.appendChild(el('dd', null, f[1])); dl.appendChild(d);
    });
    panel.appendChild(dl);
  }
  show(0);
})();
