/* Admin console: pipeline of every prospect and client, plus everything they see in their portal. */
(function () {
  'use strict';
  var h = MR.h, view = document.getElementById('view');
  var STAGES = [], ALL = [], filter = 'all', current = null;

  document.getElementById('logout').addEventListener('click', function () {
    MR.api('/logout', { method: 'POST' }).finally(function () { location.href = '/portal'; });
  });
  window.addEventListener('hashchange', route);

  MR.api('/me').then(function (d) {
    if (d.user.role !== 'admin') return location.replace('/portal/app');
    document.getElementById('me').textContent = d.user.email;
    route();
  });

  function route() {
    var m = location.hash.match(/^#acct\/(\w+)/);
    if (m) return openAccount(m[1]);
    if (location.hash === '#new') return newAccount();
    list();
  }
  var stageLabel = function (k) { var s = STAGES.find(function (x) { return x.key === k; }); return s ? s.label : k.charAt(0).toUpperCase() + k.slice(1); };
  var err = function (e) { alert(e.message); };

  // ---------- pipeline ----------
  function list() {
    MR.api('/admin/accounts').then(function (d) {
      STAGES = d.stages; ALL = d.all_stages;
      MR.clear(view);
      view.appendChild(h('div', { class: 'hello' },
        h('div', null, h('h1', { text: 'Clients & prospects' }), h('p', { class: 'sub', text: d.accounts.length + (d.accounts.length === 1 ? ' account' : ' accounts') + ' · everyone here can sign in to their own portal' })),
        h('a', { class: 'btn btn-primary', href: '#new' }, '+ New account')));

      var waiting = d.accounts.reduce(function (n, a) { return n + a.open_requests; }, 0);
      var appr = d.accounts.reduce(function (n, a) { return n + a.pending_approvals; }, 0);
      view.appendChild(h('div', { class: 'stats' },
        card('Prospects', d.accounts.filter(function (a) { return ['prospect', 'call', 'proposal', 'agreement'].indexOf(a.stage) >= 0; }).length),
        card('In setup / read-only', d.accounts.filter(function (a) { return a.stage === 'setup' || a.stage === 'read_only'; }).length),
        card('Live clients', d.accounts.filter(function (a) { return a.stage === 'live'; }).length),
        card('Open requests', waiting, waiting ? 'amber' : ''),
        card('Waiting on clients', appr)));

      var pipe = h('div', { class: 'pipe', role: 'group', 'aria-label': 'Filter by stage' });
      ['all'].concat(ALL).forEach(function (k) {
        var n = k === 'all' ? d.accounts.length : d.accounts.filter(function (a) { return a.stage === k; }).length;
        pipe.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === k), onclick: function () { filter = k; list(); } },
          (k === 'all' ? 'All' : stageLabel(k)) + ' · ' + n));
      });
      view.appendChild(pipe);

      var rows = d.accounts.filter(function (a) { return filter === 'all' || a.stage === filter; });
      if (!rows.length) { view.appendChild(h('p', { class: 'empty', style: null, text: d.accounts.length ? 'Nobody at this stage.' : 'No accounts yet. Add your first prospect with "+ New account".' })); return; }
      var tb = h('tbody');
      rows.forEach(function (a) {
        tb.appendChild(h('tr', { class: 'click', tabindex: '0', onclick: function () { location.hash = 'acct/' + a.id; }, onkeydown: function (e) { if (e.key === 'Enter') location.hash = 'acct/' + a.id; } },
          h('td', null, h('b', { text: a.business_name }), h('br'), h('span', { class: 'small muted', text: [a.contact_name, a.email].filter(Boolean).join(' · ') })),
          h('td', null, h('span', { class: 'stage stage-' + a.stage, text: stageLabel(a.stage) })),
          h('td', { text: a.plan ? a.plan + (a.plan_price_cents ? ' · ' + MR.money(a.plan_price_cents) : '') : '—' }),
          h('td', null, a.open_requests ? h('span', { class: 'warn', text: a.open_requests + ' open' }) : '—'),
          h('td', { text: a.last_login_at ? MR.date(a.last_login_at, true) : 'Never' }),
          h('td', { text: a.last_activity_at ? MR.date(a.last_activity_at) : '' })));
      });
      view.appendChild(h('div', { class: 'card flush scroll', style: null },
        h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Business', 'Stage', 'Plan', 'Requests', 'Last sign-in', 'Last activity'].map(function (t) { return h('th', { scope: 'col', text: t }); }))), tb)));
    }).catch(err);
  }
  function card(l, v, c) { return h('div', { class: 'card' }, h('p', { class: 'label', text: l }), h('p', { class: 'big' + (c ? ' ' + c : ''), text: String(v) })); }

  function stageSelect(name, value) {
    var s = h('select', { name: name });
    (ALL.length ? ALL : ['prospect']).forEach(function (k) { s.appendChild(h('option', { value: k, text: stageLabel(k), selected: k === value ? true : null })); });
    return s;
  }
  function field(label, input) { return h('label', { class: 'f' }, label, input); }
  function inp(name, value, type, extra) { return h('input', Object.assign({ name: name, type: type || 'text', value: value == null ? '' : value }, extra || {})); }

  function showLink(container, title, url, email) {
    var box = h('input', { type: 'text', readonly: true, value: url, 'aria-label': 'Setup link' });
    var copy = h('button', { type: 'button', class: 'btn btn-sm', onclick: function () {
      box.select(); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { copy.textContent = 'Copied'; }).catch(function () { document.execCommand('copy'); copy.textContent = 'Copied'; });
    } }, 'Copy');
    var mail = h('a', { class: 'btn btn-sm', href: 'mailto:' + encodeURIComponent(email || '') + '?subject=' + encodeURIComponent('Your Minutes Regained client portal') +
      '&body=' + encodeURIComponent('Hi,\n\nHere is your private link to set up your Minutes Regained client portal. It works once and expires in 7 days:\n\n' + url + '\n\nAfter that, sign in any time at https://minutesregained.com/portal\n\nJerome') }, 'Email it');
    container.appendChild(h('div', { class: 'card next', style: null }, h('div', { style: null },
      h('p', { class: 'label', text: title }), h('p', { text: 'Send this to the client. It works once and expires in 7 days.' }),
      h('div', { class: 'linkbox' }, box, copy, mail))));
  }

  // ---------- new account ----------
  function newAccount() {
    if (!ALL.length) return MR.api('/admin/accounts').then(function (d) { STAGES = d.stages; ALL = d.all_stages; newAccount(); });
    MR.clear(view);
    view.appendChild(h('p', null, h('a', { href: '#', text: '← All accounts' })));
    view.appendChild(h('h1', { text: 'New account' }));
    view.appendChild(h('p', { class: 'sub', text: 'Works for a prospect before the call or a signed client. You get a one-time link to send them.' }));
    var msg = h('p', { class: 'msg', hidden: true, role: 'alert' });
    var f = h('form', { class: 'card', style: null, novalidate: true },
      h('div', { class: 'grid2' },
        field('Business name', inp('business_name', '', 'text', { required: true })),
        field('Contact name', inp('contact_name')),
        field('Login email', inp('email', '', 'email', { required: true })),
        field('Phone', inp('phone', '', 'tel')),
        field('Industry', inp('industry', '', 'text', { placeholder: 'Plumbing, cottage rentals…' })),
        field('Stage', stageSelect('stage', 'prospect')),
        field('Plan', inp('plan', '', 'text', { placeholder: 'Essential / Business Support / Custom Build' })),
        field('Monthly price (cents)', inp('plan_price_cents', '', 'number', { placeholder: '65000 = $650' })),
        field('Hands-on hours included', inp('hours_included', '', 'number', { step: '0.5' })),
        field('Source', inp('source', '', 'text', { placeholder: 'Website, referral…' }))),
      field('Next step the client sees ', inp('next_step', '', 'text', { placeholder: 'e.g. Free call booked for Tue 10 AM' })),
      h('label', { class: 'check', style: null }, h('input', { type: 'checkbox', name: 'default_automations', checked: true }), 'Add the 5 standard automations (in setup, Ask me)'),
      msg, h('p', null, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Create account and get setup link')));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = MR.formData(f), b = f.querySelector('button[type=submit]');
      b.disabled = true;
      MR.api('/admin/accounts', { method: 'POST', body: d }).then(function (r) {
        MR.clear(view);
        view.appendChild(h('h1', { text: d.business_name + ' is set up' }));
        showLink(view, 'Portal setup link', r.setup_url, d.email);
        view.appendChild(h('p', null, h('a', { class: 'btn btn-primary', href: '#acct/' + r.id }, 'Open the account'), ' ', h('a', { class: 'btn', href: '#' }, 'Back to all accounts')));
      }).catch(function (x) { b.disabled = false; MR.msg(msg, x.message); });
    });
    view.appendChild(f);
  }

  // ---------- one account ----------
  function openAccount(aid) {
    var load = ALL.length ? Promise.resolve() : MR.api('/admin/accounts').then(function (d) { STAGES = d.stages; ALL = d.all_stages; });
    load.then(function () { return MR.api('/admin/accounts/' + aid); }).then(function (d) { current = d; drawAccount(); }).catch(err);
  }
  var refresh = function () { openAccount(current.account.id); };
  function post(path, body) { return MR.api(path, { method: 'POST', body: body }); }
  function patch(path, body) { return MR.api(path, { method: 'PATCH', body: body }); }

  function drawAccount() {
    var d = current, a = d.account;
    MR.clear(view);
    view.appendChild(h('p', null, h('a', { href: '#', text: '← All accounts' })));
    view.appendChild(h('div', { class: 'hello' },
      h('div', null, h('h1', { text: a.business_name }), h('p', { class: 'sub', text: [a.contact_name, a.industry, a.phone].filter(Boolean).join(' · ') || 'No contact details yet' })),
      h('span', { class: 'stage stage-' + a.stage, text: stageLabel(a.stage) })));

    // logins
    var logins = h('div', { class: 'card', style: null }, h('p', { class: 'label', text: 'Portal logins' }));
    d.users.forEach(function (u) {
      logins.appendChild(h('div', { class: 'itemrow' },
        h('div', null, h('div', { class: 't', text: u.email }), h('div', { class: 'm', text: u.active ? 'Active · last sign-in ' + (u.last_login_at ? MR.date(u.last_login_at, true) : 'never') : 'Has not set a password yet' })),
        h('button', { type: 'button', class: 'btn btn-sm', onclick: function () {
          post('/admin/accounts/' + a.id + '/invite', { email: u.email }).then(function (r) { showLink(logins, (u.active ? 'Password reset link for ' : 'Setup link for ') + r.email, r.setup_url, r.email); }).catch(err);
        } }, u.active ? 'Reset link' : 'New setup link')));
    });
    var addLogin = h('form', { class: 'linkbox', novalidate: true }, h('input', { type: 'email', name: 'email', placeholder: 'Add another login email', 'aria-label': 'Add login email' }), h('button', { type: 'submit', class: 'btn btn-sm' }, 'Add login'));
    addLogin.addEventListener('submit', function (e) {
      e.preventDefault(); var em = addLogin.email.value.trim(); if (!em) return;
      post('/admin/accounts/' + a.id + '/invite', { email: em }).then(function (r) { showLink(logins, 'Setup link for ' + r.email, r.setup_url, r.email); }).catch(err);
    });
    logins.appendChild(addLogin);

    // details form
    var msg = h('p', { class: 'msg', hidden: true, role: 'status' });
    var det = h('form', { class: 'card', novalidate: true },
      h('p', { class: 'label', text: 'Account details' }),
      h('div', { class: 'grid2', style: null },
        field('Stage', stageSelect('stage', a.stage)),
        field('Business name', inp('business_name', a.business_name)),
        field('Contact name', inp('contact_name', a.contact_name)),
        field('Phone', inp('phone', a.phone, 'tel')),
        field('Industry', inp('industry', a.industry)),
        field('Plan', inp('plan', a.plan)),
        field('Monthly price (cents)', inp('plan_price_cents', a.plan_price_cents, 'number')),
        field('Hours included', inp('hours_included', a.hours_included, 'number', { step: '0.5' })),
        field('Hours used', inp('hours_used', a.hours_used, 'number', { step: '0.25' })),
        field('Next invoice date', inp('next_invoice_date', a.next_invoice_date, 'date'))),
      field('Next step the client sees', inp('next_step', a.next_step)),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'founding', checked: a.founding ? true : null }), 'Founding client (price locked)'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'paused', checked: a.paused ? true : null }), 'Everything paused'),
      msg, h('p', null, h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save details')));
    det.addEventListener('submit', function (e) {
      e.preventDefault();
      patch('/admin/accounts/' + a.id, MR.formData(det)).then(function () { MR.msg(msg, 'Saved.', true); setTimeout(refresh, 600); }).catch(function (x) { MR.msg(msg, x.message); });
    });

    var notes = section('Internal notes', 'Only you see these.', d.notes, function (n) { return [MR.date(n.created_at, true), n.body]; }, 'notes',
      [['body', 'Note', 'textarea']]);
    view.appendChild(h('div', { class: 'cols' }, h('div', null, det), h('div', null, logins, notes, activity(d.activity))));

    // client-facing
    view.appendChild(h('h2', { class: 'sect', text: 'What the client sees' }));
    var cols = h('div', { class: 'cols' });
    cols.appendChild(requestsSection(d.requests));
    cols.appendChild(section('Waiting on them (approvals)', 'Anything with a price, a date or a promise.', d.approvals,
      function (x) { return [x.kind + ' · ' + x.status + (x.client_note ? ' · note: ' + x.client_note : ''), x.title + (x.detail ? '\n' + x.detail : '')]; }, 'approvals',
      [['kind', 'Type', 'text', 'QUOTE · ASK ME'], ['title', 'Title'], ['detail', 'Details', 'textarea']]));
    cols.appendChild(section('Morning reports', 'Paste the SITREP you sent today.', d.reports,
      function (x) { return [MR.weekday(x.report_date), x.summary]; }, 'reports',
      [['report_date', 'Date', 'date', new Date().toISOString().slice(0, 10)], ['summary', 'One-line summary', 'text', '2 waiting on you · 2 leads answered'], ['needs_you', 'Needs your OK', 'textarea'], ['call_back', 'Call back first', 'textarea'], ['handled', 'Handled', 'textarea'], ['system_check', 'System check', 'textarea']]));
    cols.appendChild(automationsSection(d.automations));
    cols.appendChild(section('Documents', 'Link to the file (Google Drive, Docs, etc.). Must start with https://', d.documents,
      function (x) { return [x.meta || '', x.name + (x.url ? '\n' + x.url : '')]; }, 'documents',
      [['name', 'Name', 'text', 'Client agreement'], ['meta', 'Note', 'text', 'Signed Nov 16'], ['url', 'Link', 'url']]));
    cols.appendChild(section('Invoices', 'Amount in cents (65000 = $650).', d.invoices,
      function (x) { return [x.status, MR.date(x.invoice_date) + ' · ' + MR.money(x.amount_cents)]; }, 'invoices',
      [['invoice_date', 'Date', 'date'], ['amount_cents', 'Amount (cents)', 'number'], ['status', 'Status', 'select:Paid,Due,Overdue'], ['url', 'Receipt link', 'url']]));
    view.appendChild(cols);

    view.appendChild(h('p', { style: null }, h('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: function () {
      if (prompt('This deletes ' + a.business_name + ' and every login, report and request. Type DELETE to confirm.') !== 'DELETE') return;
      MR.api('/admin/accounts/' + a.id, { method: 'DELETE' }).then(function () { location.hash = ''; }).catch(err);
    } }, 'Delete account')));
  }

  function activity(items) {
    var ul = h('ul', { class: 'feed' });
    items.slice(0, 15).forEach(function (x) { ul.appendChild(h('li', null, h('time', { text: MR.date(x.created_at, true) + ' · ' + x.actor }), x.text)); });
    return h('div', { class: 'card', style: null }, h('p', { class: 'label', text: 'Activity' }), ul.firstChild ? ul : h('p', { class: 'muted', text: 'Nothing yet.' }));
  }

  function control(def) {
    var name = def[0], type = def[2] || 'text';
    if (type === 'textarea') return h('textarea', { name: name, rows: '3' });
    if (type.indexOf('select:') === 0) { var s = h('select', { name: name }); type.slice(7).split(',').forEach(function (o) { s.appendChild(h('option', { text: o })); }); return s; }
    return h('input', { name: name, type: type, value: def[3] && type === 'date' ? def[3] : '', placeholder: def[3] && type !== 'date' ? def[3] : null, step: type === 'number' ? 'any' : null });
  }

  function section(title, hint, items, describe, table, defs) {
    var c = h('div', { class: 'card' }, h('p', { class: 'label', text: title }), h('p', { class: 'small muted', text: hint }));
    items.forEach(function (x) {
      var dsc = describe(x);
      c.appendChild(h('div', { class: 'itemrow' }, h('div', null, h('div', { class: 'm', text: dsc[0] }), h('div', { class: 't', text: dsc[1] })),
        h('button', { type: 'button', class: 'btn btn-sm btn-danger', 'aria-label': 'Delete', onclick: function () {
          if (!confirm('Delete this?')) return;
          MR.api('/admin/' + table + '/' + x.id, { method: 'DELETE' }).then(refresh).catch(err);
        } }, 'Delete')));
    });
    var f = h('form', { class: 'mini', novalidate: true, style: null }, defs.map(function (dd) { return field(dd[1], control(dd)); }), h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Add'));
    var det = h('details', { style: null }, h('summary', { class: 'linkbtn', text: '+ Add' }), f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      post('/admin/accounts/' + current.account.id + '/' + table, MR.formData(f)).then(refresh).catch(err);
    });
    c.appendChild(det);
    return c;
  }

  function requestsSection(items) {
    var c = h('div', { class: 'card' }, h('p', { class: 'label', text: 'Requests from the client' }), h('p', { class: 'small muted', text: 'Hours you log here are added to their hands-on hours used.' }));
    if (!items.length) c.appendChild(h('p', { class: 'muted', text: 'None yet.' }));
    items.forEach(function (q) {
      var f = h('form', { class: 'mini', novalidate: true },
        field('Status', (function () { var s = h('select', { name: 'status' }); ['Received', 'In progress', 'Done'].forEach(function (o) { s.appendChild(h('option', { text: o, selected: o === q.status ? true : null })); }); return s; })()),
        field('Hours', h('input', { type: 'number', name: 'hours', step: '0.25', value: q.hours == null ? '' : q.hours })),
        field('Reply the client sees', h('input', { type: 'text', name: 'reply', value: q.reply || '' })),
        h('button', { type: 'submit', class: 'btn btn-sm btn-primary' }, 'Update'));
      f.addEventListener('submit', function (e) { e.preventDefault(); patch('/admin/requests/' + q.id, MR.formData(f)).then(refresh).catch(err); });
      c.appendChild(h('div', { class: 'itemrow' }, h('div', { style: null },
        h('div', { class: 'm', text: MR.date(q.created_at, true) + ' · ' + q.urgency + ' · ' + q.status }), h('div', { class: 't', text: q.body }), f)));
    });
    return c;
  }

  function automationsSection(items) {
    var c = h('div', { class: 'card' }, h('p', { class: 'label', text: 'Automations' }), h('p', { class: 'small muted', text: 'Change a level or status and it updates for the client right away.' }));
    items.forEach(function (j) {
      var lv = h('select', { name: 'level', 'aria-label': j.name + ' level' }); ['Do it', 'Tell me', 'Ask me', 'Never'].forEach(function (o) { lv.appendChild(h('option', { text: o, selected: o === j.level ? true : null })); });
      var st = h('select', { name: 'status', 'aria-label': j.name + ' status' }); ['In setup', 'Read-only', 'Running', 'Needs attention'].forEach(function (o) { st.appendChild(h('option', { text: o, selected: o === j.status ? true : null })); });
      var save = function () { patch('/admin/automations/' + j.id, { level: lv.value, status: st.value }).catch(err); };
      lv.addEventListener('change', save); st.addEventListener('change', save);
      c.appendChild(h('div', { class: 'itemrow' }, h('div', null, h('div', { class: 't', text: j.name }), h('div', { class: 'm', text: j.rule || '' })),
        h('div', { class: 'linkbox' }, lv, st, h('button', { type: 'button', class: 'btn btn-sm btn-danger', onclick: function () {
          if (confirm('Remove ' + j.name + '?')) MR.api('/admin/automations/' + j.id, { method: 'DELETE' }).then(refresh).catch(err);
        } }, 'Remove'))));
    });
    var f = h('form', { class: 'mini', novalidate: true }, field('Name', h('input', { name: 'name' })), field('What it does', h('input', { name: 'rule' })), h('button', { type: 'submit', class: 'btn btn-sm btn-primary' }, 'Add'));
    f.addEventListener('submit', function (e) { e.preventDefault(); post('/admin/accounts/' + current.account.id + '/automations', MR.formData(f)).then(refresh).catch(err); });
    c.appendChild(h('details', null, h('summary', { class: 'linkbtn', text: '+ Add automation' }), f));
    return c;
  }
})();
