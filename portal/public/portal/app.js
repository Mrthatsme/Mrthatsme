/* Client dashboard. */
(function () {
  'use strict';
  var h = MR.h, D = null, tab = (location.hash || '#overview').slice(1);
  var view = document.getElementById('view'), tabsEl = document.getElementById('tabs');

  var TABS = [
    ['overview', 'Overview'], ['start', 'Getting started'], ['approvals', 'Waiting on you'], ['reports', 'Morning reports'],
    ['autos', 'Automations'], ['requests', 'Requests'], ['billing', 'Plan & billing'], ['docs', 'Documents'], ['account', 'Your login'],
  ];

  document.getElementById('logout').addEventListener('click', function () {
    MR.api('/logout', { method: 'POST' }).finally(function () { location.href = '/portal'; });
  });
  window.addEventListener('hashchange', function () { tab = location.hash.slice(1) || 'overview'; render(); });

  function load() {
    return MR.api('/dashboard').then(function (d) {
      if (d.user.role === 'admin' && !d.account) { location.replace('/portal/admin'); return; }
      D = d; render();
    }).catch(function (e) {
      if (/admin console/.test(e.message)) return location.replace('/portal/admin');
      MR.clear(view).appendChild(h('p', { class: 'msg msg-err', text: e.message }));
    });
  }

  var pending = function () { return D.approvals.filter(function (a) { return a.status === 'pending'; }); };
  var stageIdx = function () { var i = D.stages.findIndex(function (s) { return s.key === D.account.stage; }); return i < 0 ? (D.account.stage === 'paused' ? D.stages.length - 1 : 0) : i; };
  var isLive = function () { return ['setup', 'read_only', 'live', 'paused'].indexOf(D.account.stage) >= 0; };

  function renderTabs() {
    MR.clear(tabsEl);
    TABS.forEach(function (t) {
      var badge = t[0] === 'approvals' && pending().length ? h('span', { class: 'badge', text: String(pending().length) }) : null;
      tabsEl.appendChild(h('button', { type: 'button', class: 'tab', 'aria-current': t[0] === tab ? 'page' : 'false',
        onclick: function () { location.hash = t[0]; } }, h('span', { text: t[1] }), badge));
    });
  }

  function render() {
    if (!D) return;
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'overview';
    document.getElementById('biz').textContent = D.account.business_name;
    renderTabs();
    MR.clear(view);
    ({ overview: overview, start: start, approvals: approvals, reports: reports, autos: autos, requests: requests, billing: billing, docs: docs, account: account })[tab]();
    view.focus({ preventScroll: true });
  }

  function greet() {
    var hr = new Date().getHours();
    var first = (D.user.name || D.account.contact_name || '').split(' ')[0];
    return (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (first ? ', ' + first : '') + '.';
  }

  function overview() {
    var a = D.account, p = pending();
    var paused = !!a.paused;
    view.appendChild(h('div', { class: 'hello' },
      h('div', null, h('p', { class: 'muted', style: null, text: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }), h('h1', { text: greet() })),
      isLive() ? h('button', { type: 'button', class: 'btn' + (paused ? ' btn-primary' : ''), 'aria-pressed': String(paused), onclick: togglePause }, paused ? 'Resume everything' : 'Pause everything') : null));
    if (paused) view.appendChild(h('p', { class: 'banner', text: 'Everything is paused. Nothing will send until you turn it back on.' }));
    if (a.next_step) view.appendChild(h('div', { class: 'next' }, h('div', null, h('p', { class: 'label', text: 'Next step' }), h('p', { text: a.next_step }))));

    var stage = D.stages[stageIdx()];
    var latest = D.reports[0];
    var openReq = D.requests.filter(function (r) { return r.status !== 'Done'; }).length;
    view.appendChild(h('div', { class: 'stats' },
      stat('Waiting on you', String(p.length), p.length ? 'amber' : ''),
      stat('Where we are', null, null, h('p', { class: 'ok', style: null, text: stage ? stage.label : a.stage })),
      stat('Open requests', String(openReq)),
      stat('Automations running', String(D.automations.filter(function (x) { return x.status === 'Running'; }).length) + ' of ' + D.automations.length)));

    var cols = h('div', { class: 'cols' });
    var rep = h('article', { class: 'card' }, h('p', { class: 'label', text: latest ? 'Latest report · ' + MR.weekday(latest.report_date) : 'Morning report' }));
    if (latest) {
      var ul = h('ul', { class: 'feed' });
      [['Needs you', latest.needs_you], ['Call back first', latest.call_back], ['Handled', latest.handled], ['System check', latest.system_check]].forEach(function (x) {
        if (x[1]) ul.appendChild(h('li', null, h('b', { text: x[0] + ': ' }), x[1]));
      });
      if (!ul.firstChild) ul.appendChild(h('li', { text: latest.summary }));
      rep.appendChild(ul);
      rep.appendChild(h('p', { style: null }, h('a', { href: '#reports', text: 'All reports' })));
    } else {
      rep.appendChild(h('p', { class: 'muted', text: 'Your first SITREP arrives once your automations start their two weeks read-only. It lands in your inbox at 6 AM and is saved here.' }));
    }
    cols.appendChild(rep);
    cols.appendChild(h('article', { class: 'card' },
      h('p', { class: 'label', text: 'Your account manager' }),
      h('div', { class: 'mgr', style: null }, h('img', { src: '/portal/img/jerome.jpg', alt: 'Jerome' }),
        h('span', null, h('b', { text: 'Jerome' }), h('br'), h('span', { class: 'muted small', text: 'Founder · replies within 1 business day' }))),
      h('p', null, h('button', { type: 'button', class: 'btn', onclick: function () { location.hash = 'requests'; } }, 'Send a request'), ' ',
        h('a', { class: 'btn', href: 'tel:+18778968784' }, '(877) 896-8784'))));
    var feed = h('ul', { class: 'feed' });
    D.activity.slice(0, 6).forEach(function (x) { feed.appendChild(h('li', null, h('time', { text: MR.date(x.created_at, true) }), x.text)); });
    cols.appendChild(h('article', { class: 'card' }, h('p', { class: 'label', text: 'Recent activity' }), feed.firstChild ? feed : h('p', { class: 'muted', text: 'Nothing yet.' })));
    view.appendChild(cols);
  }
  function stat(label, value, cls, custom) {
    return h('div', { class: 'card' }, h('p', { class: 'label', text: label }), custom || h('p', { class: 'big' + (cls ? ' ' + cls : ''), text: value }));
  }

  function togglePause() {
    var next = !D.account.paused;
    if (next && !confirm('Pause everything? Nothing will send to your customers until you turn it back on.')) return;
    MR.api('/pause', { method: 'POST', body: { paused: next } }).then(load).catch(function (e) { alert(e.message); });
  }

  function start() {
    var idx = stageIdx(), n = D.stages.length;
    view.appendChild(h('h1', { text: 'Getting started' }));
    view.appendChild(h('p', { class: 'sub', text: 'Where your setup stands, step by step. Nothing reaches a customer until you have seen it work for two weeks.' }));
    var pct = Math.round((Math.min(idx, n - 1) / (n - 1)) * 100);
    var bar = h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Setup progress' }, h('i'));
    bar.firstChild.style.width = pct + '%';
    var card = h('div', { class: 'card', style: null }, h('p', { class: 'label', text: 'Step ' + (idx + 1) + ' of ' + n }), bar);
    var DETAIL = {
      prospect: 'We have your request. We reply within 1 business day to set up your free call.',
      call: 'A free 30-minute call with Jerome. We walk through where your week goes.',
      proposal: 'A written plan by email: the jobs we take on, the price and the timeline. Yours to keep either way.',
      agreement: 'You sign the service agreement and NDA. Confidentiality comes before we see a single email.',
      setup: 'We build inside your own accounts, using the access you grant. You get a written guide for every setup.',
      read_only: 'Nothing sends to your customers. Each morning you read what it would have said, and we adjust.',
      live: 'You pick a level for every task. Prices, dates and promises always wait for your OK.',
    };
    var ol = h('ol', { class: 'track' });
    D.stages.forEach(function (s, i) {
      var state = i < idx || D.account.stage === 'live' && i === idx ? 'done' : i === idx ? 'now' : '';
      ol.appendChild(h('li', { class: state, 'aria-current': state === 'now' ? 'step' : null },
        h('span', { class: 'dot', 'aria-hidden': 'true', text: state === 'done' ? '✓' : String(i + 1) }),
        h('span', null, h('b', { text: s.client }), h('span', { class: 'd', text: (state === 'now' ? 'Now: ' : '') + (DETAIL[s.key] || '') }))));
    });
    card.appendChild(ol);
    view.appendChild(card);
    if (D.account.stage === 'agreement' || D.account.stage === 'proposal') {
      view.appendChild(h('div', { class: 'card', style: null }, h('p', { class: 'label', text: 'Useful links' }),
        h('ul', { class: 'feed' },
          h('li', null, h('a', { href: '/agreement', text: 'Read the service agreement' })),
          h('li', null, h('a', { href: '/access', text: 'How to connect your tools' })),
          h('li', null, h('a', { href: '/pricing', text: 'Plans and pricing' })))));
    }
  }

  function approvals() {
    view.appendChild(h('h1', { text: 'Waiting on you' }));
    view.appendChild(h('p', { class: 'sub', text: 'Anything with a price, a date or a promise lands here first.' }));
    var list = h('div', { class: 'stack' });
    if (!D.approvals.length) list.appendChild(h('p', { class: 'empty', text: 'Nothing waiting. You’re all caught up.' }));
    D.approvals.forEach(function (a) {
      var done = a.status !== 'pending';
      var acts = done ? h('p', { class: a.status === 'approved' ? 'ok' : 'warn', text: (a.status === 'approved' ? 'Approved' : 'Declined') + (a.decided_at ? ' · ' + MR.date(a.decided_at, true) : '') }) :
        h('div', { class: 'acts' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { decide(a, 'approve', this); } }, 'Approve'),
          h('button', { type: 'button', class: 'btn', onclick: function () { decide(a, 'decline', this); } }, 'Decline'));
      list.appendChild(h('article', { class: 'appr' + (done ? ' done' : '') },
        h('div', { class: 'body' }, h('p', { class: 'label', text: a.kind }), h('p', { class: 'title', text: a.title }), a.detail ? h('p', { class: 'detail', text: a.detail }) : null), acts));
    });
    view.appendChild(list);
  }
  function decide(a, decision, btn) {
    var note = null;
    if (decision === 'decline') { note = prompt('Anything we should change? (optional)'); if (note === null) return; }
    btn.disabled = true;
    MR.api('/approvals/' + a.id, { method: 'POST', body: { decision: decision, note: note } }).then(load).catch(function (e) { btn.disabled = false; alert(e.message); });
  }

  function reports() {
    view.appendChild(h('h1', { text: 'Morning reports' }));
    view.appendChild(h('p', { class: 'sub', text: 'Your SITREP lands in your inbox at 6 AM. Every one is saved here too.' }));
    var list = h('div', { class: 'stack' });
    if (!D.reports.length) list.appendChild(h('p', { class: 'empty', text: 'No reports yet. They start during your two weeks read-only.' }));
    D.reports.forEach(function (r, i) {
      var d = h('details', { class: 'card report', open: i === 0 ? true : null },
        h('summary', null, h('b', { text: MR.weekday(r.report_date) }), h('span', { text: r.summary })));
      [['needs', 'Needs your OK', r.needs_you], ['', 'Call back first', r.call_back], ['handled', 'Handled', r.handled], ['sys', 'System check', r.system_check]].forEach(function (s) {
        if (s[2]) d.appendChild(h('div', { class: 'sec ' + s[0] }, h('p', { class: 'label', text: s[1] }), h('p', { text: s[2] })));
      });
      list.appendChild(d);
    });
    view.appendChild(list);
  }

  function autos() {
    view.appendChild(h('h1', { text: 'Your automations' }));
    view.appendChild(h('p', { class: 'sub', text: 'Checked every morning at 6 AM. Ask us to change a level any time.' }));
    if (!D.automations.length) return view.appendChild(h('p', { class: 'empty', style: null, text: 'We list your automations here once we map them together.' }));
    var c = h('div', { class: 'card flush', style: null });
    D.automations.forEach(function (j) {
      c.appendChild(h('div', { class: 'row' },
        h('b', { class: 'grow', text: j.name }), h('span', { class: 'muted small', text: j.rule || '' }),
        h('span', { class: MR.levelClass(j.level), text: j.level }),
        h('span', { class: D.account.paused ? 'warn' : j.status === 'Running' ? 'ok' : 'muted', text: D.account.paused ? 'Paused' : j.status })));
    });
    view.appendChild(c);
    view.appendChild(h('div', { class: 'card', style: null }, h('p', { class: 'label', text: 'What the levels mean' }),
      h('ul', { class: 'feed' }, h('li', null, h('b', { text: 'Do it: ' }), 'routine work, like logging a new lead.'), h('li', null, h('b', { text: 'Tell me: ' }), 'does it, then lets you know.'),
        h('li', null, h('b', { text: 'Ask me: ' }), 'anything with a price, a date or a promise waits for you.'), h('li', null, h('b', { text: 'Never: ' }), 'takes a payment or signs anything. Ever.'))));
  }

  function requests() {
    view.appendChild(h('h1', { text: 'Requests' }));
    view.appendChild(h('p', { class: 'sub', text: 'Need something that isn’t automated? Ask here. It counts toward your hands-on hours.' }));
    var msg = h('p', { class: 'msg', role: 'status', hidden: true });
    var form = h('form', { class: 'card', novalidate: true },
      h('label', { class: 'f' }, 'What do you need?', h('textarea', { name: 'body', rows: '5', required: true })),
      h('label', { class: 'f' }, 'How soon?', h('select', { name: 'urgency' }, h('option', { text: 'This week' }), h('option', { text: 'Today, it’s urgent' }), h('option', { text: 'No rush' }))),
      h('p', null, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Send request')), msg);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = MR.formData(form);
      if (!d.body.trim()) return MR.msg(msg, 'Tell us what you need.');
      var b = form.querySelector('button'); b.disabled = true;
      MR.api('/requests', { method: 'POST', body: d }).then(function () { tab = 'requests'; return load(); })
        .then(function () { var m = view.querySelector('.msg'); if (m) MR.msg(m, 'Sent. You’ll hear back within 1 business day.', true); })
        .catch(function (x) { b.disabled = false; MR.msg(msg, x.message); });
    });
    var list = h('div', { class: 'stack', style: null });
    if (!D.requests.length) list.appendChild(h('p', { class: 'empty', text: 'No requests yet.' }));
    D.requests.forEach(function (q) {
      list.appendChild(h('article', { class: 'card' },
        h('p', { style: null, class: 'title', text: q.body }),
        h('p', { class: 'small muted' }, MR.date(q.created_at) + ' · ' + q.urgency + ' · ', h('span', { class: 'status ' + (q.status === 'Done' ? 'ok' : q.status === 'In progress' ? 'warn' : ''), text: q.status })),
        q.reply ? h('p', { class: 'small' }, h('b', { text: 'Our reply: ' }), q.reply) : null));
    });
    var cols = h('div', { class: 'cols' }, form, list);
    view.appendChild(cols);
  }

  function billing() {
    var a = D.account;
    view.appendChild(h('h1', { text: 'Plan & billing' }));
    var pct = a.hours_included ? Math.min(100, Math.round((a.hours_used / a.hours_included) * 100)) : 0;
    var bar = h('div', { class: 'progress' }, h('i')); bar.firstChild.style.width = pct + '%';
    view.appendChild(h('div', { class: 'stats' },
      h('div', { class: 'card' }, h('p', { class: 'label', text: 'Your plan' }), h('p', { class: 'title big', style: null, text: a.plan || 'Not chosen yet' }),
        h('p', { class: 'muted', text: a.plan_price_cents ? MR.money(a.plan_price_cents) + '/month' + (a.founding ? ' · founding client price, locked' : '') : 'We confirm your plan after the free call.' })),
      h('div', { class: 'card' }, h('p', { class: 'label', text: 'Hands-on hours this month' }), h('p', { class: 'title', text: a.hours_included ? a.hours_used + ' of ' + a.hours_included + ' used' : 'Not included yet' }), a.hours_included ? bar : null),
      h('div', { class: 'card' }, h('p', { class: 'label', text: 'Next invoice' }), h('p', { class: 'title', text: a.next_invoice_date ? MR.date(a.next_invoice_date) : 'None scheduled' }),
        h('p', { class: 'muted', text: a.next_invoice_date && a.plan_price_cents ? MR.money(a.plan_price_cents) : '' }))));
    var c = h('div', { class: 'card flush', style: null });
    if (!D.invoices.length) c.appendChild(h('p', { class: 'row muted', text: 'No invoices yet.' }));
    D.invoices.forEach(function (i) {
      c.appendChild(h('div', { class: 'row' }, h('span', { class: 'grow', text: MR.date(i.invoice_date) }), h('span', { text: MR.money(i.amount_cents) }),
        h('b', { class: i.status === 'Paid' ? 'ok' : 'warn', text: i.status }), i.url ? h('a', { href: i.url, target: '_blank', rel: 'noopener', text: 'View' }) : null));
    });
    view.appendChild(c);
    view.appendChild(h('p', { class: 'sub' }, 'Change your card, download receipts or cancel directly with Stripe from the billing link in your receipt email. Need it again? ', h('a', { href: 'mailto:support@minutesregained.com?subject=Billing%20link', text: 'Email us' }), '.'));
  }

  function docs() {
    view.appendChild(h('h1', { text: 'Documents' }));
    view.appendChild(h('p', { class: 'sub', text: 'Your agreement and a written guide for everything we built. It’s all yours to keep.' }));
    var g = h('div', { class: 'cols' });
    if (!D.documents.length) view.appendChild(h('p', { class: 'empty', style: null, text: 'Your signed agreement, NDA and setup guides will appear here.' }));
    D.documents.forEach(function (d) {
      var name = d.url ? h('a', { href: d.url, target: '_blank', rel: 'noopener', text: d.name }) : h('b', { text: d.name });
      g.appendChild(h('div', { class: 'card doc' }, h('span', { class: 'ic', 'aria-hidden': 'true', text: '☰' }), h('span', null, name, h('br'), h('span', { class: 'small muted', text: d.meta || MR.date(d.created_at) }))));
    });
    view.appendChild(g);
  }

  function account() {
    view.appendChild(h('h1', { text: 'Your login' }));
    view.appendChild(h('p', { class: 'sub', text: 'Signed in as ' + D.user.email + '.' }));
    var msg = h('p', { class: 'msg', hidden: true, role: 'status' });
    var f = h('form', { class: 'card', style: null, novalidate: true },
      h('label', { class: 'f' }, 'Current password', h('input', { type: 'password', name: 'current', autocomplete: 'current-password' })),
      h('label', { class: 'f' }, 'New password ', h('span', { class: 'hint', text: '(10 characters or more)' }), h('input', { type: 'password', name: 'password', autocomplete: 'new-password' })),
      h('p', null, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Change password')), msg);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      MR.api('/password', { method: 'POST', body: MR.formData(f) }).then(function () { f.reset(); MR.msg(msg, 'Password changed. Other devices were signed out.', true); })
        .catch(function (x) { MR.msg(msg, x.message); });
    });
    view.appendChild(f);
  }

  load();
})();
