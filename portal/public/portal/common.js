/* Shared helpers. Every bit of user data goes in through textContent, never innerHTML. */
(function () {
  'use strict';
  var MR = window.MR = {};

  MR.api = function (path, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch('/api/portal' + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && !opts.noRedirect) { location.href = '/portal'; throw new Error('Please sign in.'); }
        if (!r.ok) throw new Error(d.error || 'Something went wrong. Try again.');
        return d;
      });
    });
  };

  /* h('div', {class:'x', onclick: fn}, child, 'text', [more]) */
  MR.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(function (x) { add(el, x); });
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  MR.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  MR.date = function (s, withTime) {
    if (!s) return '';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s);
    if (isNaN(d)) return s;
    var o = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
    var out = d.toLocaleDateString('en-US', o);
    if (withTime) out += ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return out;
  };
  MR.weekday = function (s) {
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T12:00:00') : new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  MR.money = function (cents) {
    if (cents == null) return '';
    return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
  };
  MR.levelClass = function (l) { return 'lvl' + (l === 'Ask me' ? ' lvl-ask' : l === 'Never' ? ' lvl-never' : ''); };

  MR.msg = function (el, text, ok) {
    el.textContent = text || '';
    el.className = 'msg ' + (ok ? 'msg-ok' : 'msg-err');
    el.hidden = !text;
  };

  MR.formData = function (form) {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (e) {
      if (!e.name) return;
      if (e.type === 'checkbox') o[e.name] = e.checked;
      else o[e.name] = e.value;
    });
    return o;
  };

  MR.logo = function () {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('width', '30'); s.setAttribute('height', '30'); s.setAttribute('viewBox', '0 0 30 30'); s.setAttribute('aria-hidden', 'true');
    [['circle', { cx: 15, cy: 15, r: 13, fill: '#0f4c42' }], ['path', { d: 'M15 15V7', stroke: '#f4f2ee', 'stroke-width': 2.4, 'stroke-linecap': 'round' }],
      ['path', { d: 'M15 15l6 3.5', stroke: '#f2b544', 'stroke-width': 2.4, 'stroke-linecap': 'round' }]].forEach(function (p) {
      var e = document.createElementNS(ns, p[0]); Object.keys(p[1]).forEach(function (k) { e.setAttribute(k, p[1][k]); }); s.appendChild(e);
    });
    return s;
  };
  document.querySelectorAll('[data-logo]').forEach(function (el) { el.insertBefore(MR.logo(), el.firstChild); });
})();
