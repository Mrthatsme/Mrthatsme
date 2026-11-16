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
