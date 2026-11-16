/* Minutes Regained, Apple-style pages: mobile menu. External file (the site's CSP allows no inline scripts). */
(function () {
  'use strict';
  var btn = document.querySelector('.mbtn'), sheet = document.getElementById('sheet');
  if (!btn || !sheet) return;
  function set(open) {
    btn.setAttribute('aria-expanded', String(open));
    sheet.hidden = !open;
  }
  btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) { set(false); btn.focus(); } });
  sheet.addEventListener('click', function (e) { if (e.target.tagName === 'A') set(false); });
})();

/* Watch it work: tabs + steps that appear one by one. Without JS every step is visible. */
(function () {
  'use strict';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.seg [data-flow]'));
  if (!tabs.length) return;
  var replay = document.querySelector('.replay');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var timers = [];
  document.documentElement.classList.add('js');
  function play(panel) {
    timers.forEach(clearTimeout); timers = [];
    var steps = panel.querySelectorAll('.st');
    Array.prototype.forEach.call(steps, function (s, i) {
      if (still) { s.classList.remove('pending'); return; }
      s.classList.add('pending');
      timers.push(setTimeout(function () { s.classList.remove('pending'); }, 250 + i * 850));
    });
    if (replay) { replay.hidden = true; timers.push(setTimeout(function () { replay.hidden = false; }, still ? 0 : 250 + steps.length * 850)); }
  }
  function show(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    play(document.getElementById(tab.getAttribute('aria-controls')));
  }
  tabs.forEach(function (t, i) {
    t.tabIndex = i === 0 ? 0 : -1;
    t.addEventListener('click', function () { show(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); show(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });
  if (replay) replay.addEventListener('click', function () { show(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0]); });
  // play the first one when it scrolls into view
  var screen = document.querySelector('.screen');
  var first = document.getElementById(tabs[0].getAttribute('aria-controls'));
  if ('IntersectionObserver' in window && screen && !still) {
    first.querySelectorAll('.st').forEach(function (s) { s.classList.add('pending'); });
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { io.disconnect(); if (tabs[0].getAttribute('aria-selected') === 'true') play(first); }
    }, { threshold: 0.35 });
    io.observe(screen);
  }
})();

/* Hero: one example per kind of business. Plumber (an emergency) is in the HTML; the rest swap in. */
(function () {
  'use strict';
  var demo = document.getElementById('demo'), btns = Array.prototype.slice.call(document.querySelectorAll('.ind [data-i]'));
  if (!demo || !btns.length) return;
  var LEAD = function (t1, t2) { return [[t1, 'A customer messages you.'], [t2, 'Answered in minutes, in words you approved. No prices, no promises.'], ['Right away', "It's on your call-back list now, and on top of tomorrow's morning report if it's still open."]]; };
  var X = [
    { av: 'R', name: 'Redline Plumbing', body: [['t', 'Tuesday 7:09 PM'], ['in', "Our water heater just burst. There's water all over the garage floor. 412 Oak St, 904-555-0142."], ['alert', 'Emergency · sent to Mike, on call tonight'], ['t', '7:10 PM'], ['out', 'Thanks for reaching out to Redline Plumbing. Our on-call technician has been alerted and will contact you at this number.'], ['saved', '✓ Mike has the address and number']],
      you: ['Where you were at 7:09 PM', 'At dinner with your family.', " Mike's on call tonight, so you weren't pulled away."], rep: ['Handled overnight:', ' burst water heater, 412 Oak St. Sent to Mike at 7:10 PM.'],
      story: [['7:09 PM', 'A customer reports an emergency.'], ['7:10 PM', "It goes straight to your on-call tech, and the customer is told your team has been alerted."], ['6:00 AM', 'Your morning report shows what happened overnight.']] },
    { av: 'C', name: 'Coastal Key Realty', body: [['t', 'Saturday 10:42 AM'], ['in', "Hi! Is the 3-bedroom on Palm Ave still available? We'd love to see it this weekend."], ['t', '10:44 AM'], ['out', "Thanks for reaching out! Happy to help. What's the best number to reach you, and are you already working with an agent?"], ['in', 'Not yet! 904-555-0187.'], ['saved', '✓ Saved to your lead list']],
      you: ['Where you were at 10:42 AM', 'Showing a house across town.', ' Phone on silent.'], rep: ['Call back first:', ' Palm Ave showing request.'], story: LEAD('10:42 AM', '10:44 AM') },
    { av: 'H', name: 'Harbor Family Law', body: [['t', 'Wednesday 9:16 AM'], ['in', 'I need to talk to someone about a custody question. Do you offer consultations?'], ['t', '9:18 AM'], ['out', "Thank you for contacting Harbor Family Law. We can't give legal advice by message, but we'd like to set up a call. What's the best number and time to reach you?"], ['in', '904-555-0113. After 5 works best.'], ['saved', '✓ Saved to your lead list']],
      you: ['Where you were at 9:16 AM', 'In court all morning.', ' Phone off.'], rep: ['Call back first:', ' custody consultation, after 5 PM.'], story: LEAD('9:16 AM', '9:18 AM') },
    { av: 'G', name: 'Greenline Lawn & Landscape', body: [['t', 'Monday 2:30 PM'], ['in', 'Do you do weekly mowing? Our lot is about half an acre.'], ['t', '2:32 PM'], ['out', "Thanks for reaching out! We'd be glad to take a look. What's the property address so we can put together a quote?"], ['in', '88 Pine Ridge Rd.'], ['saved', '✓ Saved to your lead list']],
      you: ['Where you were at 2:30 PM', 'On a mower.', ' Phone in the truck.'], rep: ['Quote to prepare:', ' weekly mowing, 88 Pine Ridge Rd.'], story: LEAD('2:30 PM', '2:32 PM') },
    { av: 'C', name: 'Clearwater Pool Care', body: [['t', 'Sunday 4:05 PM'], ['in', 'Our pool turned green after the storm. Can you help?'], ['t', '4:07 PM'], ['out', "Sorry to hear that! We can help. What's the address, and is it in-ground or above-ground?"], ['in', 'In-ground. 17 Bay Dr.'], ['saved', '✓ Saved to your lead list']],
      you: ['Where you were at 4:05 PM', 'Elbow-deep in a pool filter.', ''], rep: ['Call back first:', ' green pool, 17 Bay Dr.'], story: LEAD('4:05 PM', '4:07 PM') },
    { av: 'R', name: 'Reel Time Charters', body: [['t', 'Friday 11:20 AM'], ['in', 'Is your boat open Saturday for 4 people? First time fishing!'], ['t', '11:22 AM'], ['out', "Thanks for reaching out to Reel Time Charters! The captain confirms dates and rates personally. What's the best number to reach you?"], ['in', '904-555-0164. Thanks!'], ['saved', '✓ Saved to your lead list']],
      you: ['Where you were at 11:20 AM', 'Offshore with a full boat.', ' No signal.'], rep: ['Call back first:', ' Saturday trip, party of 4.'], story: LEAD('11:20 AM', '11:22 AM') },
    { av: 'S', name: 'Summit Roofing', body: [['t', 'Thursday 7:48 AM'], ['in', "We'd like a quote to replace our roof. It's about 20 years old."], ['t', '7:50 AM'], ['out', "Thanks for reaching out to Summit Roofing! What's the address and the best number to reach you?"], ['in', '2204 Elm Ct. 904-555-0129.'], ['saved', '✓ Saved to your lead list']],
      you: ['Where you were at 7:48 AM', 'Up on a roof two towns over.', ''], rep: ['Quote to prepare:', ' roof replacement, 2204 Elm Ct.'], story: LEAD('7:48 AM', '7:50 AM') }
  ];
  var CLS = { t: 'ph-time', 'in': 'bubble in', out: 'bubble out', alert: 'ph-alert', saved: 'ph-saved' };
  var $ = function (id) { return document.getElementById(id); };
  var story = $('d-story'), still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, timer = null;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function chip(node, small, b, rest) { node.textContent = ''; node.appendChild(el('small', null, small)); node.appendChild(el('b', null, b)); node.appendChild(document.createTextNode(rest)); }
  function paint(i) {
    var x = X[i]; $('d-av').textContent = x.av; $('d-name').textContent = x.name;
    var body = $('d-body'); body.textContent = '';
    x.body.forEach(function (r) { body.appendChild(el('p', CLS[r[0]], r[1])); });
    chip($('d-you'), x.you[0], x.you[1], x.you[2]);
    chip($('d-rep'), i === 0 ? '6:00 AM · your morning report' : 'Your call-back list', x.rep[0], x.rep[1]);
    story.textContent = '';
    x.story.forEach(function (s) { var li = el('li'); li.appendChild(el('time', null, s[0])); li.appendChild(el('span', null, s[1])); story.appendChild(li); });
    btns.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
  }
  function show(i) {
    cur = i;
    if (still) { paint(i); return; }
    demo.classList.add('swap'); story.classList.add('swap');
    setTimeout(function () { paint(i); demo.classList.remove('swap'); story.classList.remove('swap'); }, 250);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  btns.forEach(function (b) { b.addEventListener('click', function () { stop(); show(+b.getAttribute('data-i')); }); });
  demo.addEventListener('pointerenter', stop);
  if (!still) timer = setInterval(function () { if (!document.hidden) show((cur + 1) % X.length); }, 7000);
})();
