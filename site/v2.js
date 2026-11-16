/* Minutes Regained v2 site script. External file so it passes the site's CSP (no inline scripts). */
(function () {
  'use strict';

  /* Old one-page links like /#pricing go to the page that now holds that section. */
  if (location.pathname === '/' && location.hash) {
    var moved = { '#control': '/services', '#admin': '/services', '#tools': '/services', '#demo': '/demo', '#who': '/about', '#signup': '/book' };
    if (moved[location.hash]) location.replace(moved[location.hash]);
  }

  /* Home: "Every task is a file" desk switcher. */
  var D = window.MR_DESKS;
  var buttons = document.querySelectorAll('[data-desk]');
  if (D && buttons.length) {
    var field = function (k) { return document.querySelector('[data-file="' + k + '"]'); };
    var list = field('checks');
    var tpl = list && list.firstElementChild ? list.firstElementChild.cloneNode(true) : null;
    var pick = function (i) {
      var f = D.files[i];
      buttons.forEach(function (b, j) {
        var on = i === j;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle(D.on, on);
        b.classList.toggle(D.off, !on);
      });
      ['tag', 'client', 'task', 'note'].forEach(function (k) { var el = field(k); if (el) el.textContent = f[k]; });
      if (list && tpl) {
        list.textContent = '';
        f.checks.forEach(function (c) {
          var li = tpl.cloneNode(true);
          /* the last text node in the template row holds the check text */
          var walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
          var last = null, n;
          while ((n = walker.nextNode())) { if (n.nodeValue.trim()) last = n; }
          if (last) last.nodeValue = c;
          list.appendChild(li);
        });
      }
    };
    buttons.forEach(function (b, i) { b.addEventListener('click', function () { pick(i); }); });
  }

  /* Book page: request form posts to the same /api/leads endpoint the old site used. */
  var form = document.querySelector('[data-lead-form]');
  if (form) {
    var loaded = Date.now();
    var err = form.querySelector('.form-err');
    var btn = form.querySelector('button[type=submit]');
    var showErr = function (m) { err.textContent = m; err.hidden = false; };
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      var g = function (k) { return (fd.get(k) || '').toString().trim(); };
      var name = g('name'), biz = g('business'), email = g('email'), phone = g('phone');
      err.hidden = true;
      if (!name || !biz || !email) return showErr('Please fill in your name, business and email.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showErr('Please enter a valid email address so we can reply.');
      var digits = phone.replace(/\D/g, '');
      if (phone && (digits.length < 10 || digits.length > 15)) return showErr('That phone number looks incomplete. Include the area code, or leave it blank.');
      btn.disabled = true; btn.textContent = 'Sending…';
      var pain = g('pain') + (g('note') ? ' — ' + g('note') : '');
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name, business: biz, contact: email, phone: phone,
          company_website: g('company_website'), elapsed_ms: Date.now() - loaded,
          contactWindow: '', pain: pain
        })
      }).then(function (r) {
        if (!r.ok) throw new Error('bad status');
        var ok = document.createElement('div');
        ok.className = 'form-ok'; ok.setAttribute('role', 'status');
        var h = document.createElement('h2'); h.textContent = 'Got it, ' + name + '.';
        var p = document.createElement('p'); p.textContent = "You'll hear back within 1 business day. Want to lock in a time now? Use the Pick a time button on this page.";
        ok.appendChild(h); ok.appendChild(p);
        form.replaceWith(ok);
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Send my request';
        showErr("That didn't send. Email support@minutesregained.com or call (877) 896-8784 and we'll pick it up the same day.");
      });
    });
  }
})();
