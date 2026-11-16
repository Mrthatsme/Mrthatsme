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
