
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- state ---------- */
  var metrics = [
    { key: 'leads',     k: 'New leads',      v: 12,   d: 'this week' },
    { key: 'appts',     k: 'Appointments',   v: 9,    d: 'booked, next 7 days' },
    { key: 'followups', k: 'Follow-ups',     v: 6,    d: 'queued and dated' },
    { key: 'approvals', k: 'Pending approvals', v: 1, d: 'waiting on the owner' },
    { key: 'tasks',     k: 'Automated tasks', v: 214, d: 'completed this month' },
    { key: 'hours',     k: 'Hours regained', v: 41.5, d: 'this month', dec: 1 }
  ];

  var stages = [
    { key: 'new',       n: 'New lead',  c: 4 },
    { key: 'contacted', n: 'Contacted', c: 5 },
    { key: 'quote',     n: 'Quote',     c: 3 },
    { key: 'scheduled', n: 'Scheduled', c: 9 },
    { key: 'completed', n: 'Completed', c: 27 }
  ];

  var activity = [
    { t: 'Answered a 7:12pm emergency text', s: 'Holding reply in 40 seconds. Owner tapped OK at 7:15pm; tonight ETA sent, on-call tech dispatched.', m: '7:12pm', hold: false },
    { t: 'Deposit invoice held for approval', s: '$1,850 on the Hanley repipe. Money-moving steps wait for a yes.', m: '4:38pm', hold: true },
    { t: 'Rescheduled Tuesday 9am for a parts delay', s: 'Moved two jobs, notified both customers and the tech, updated the calendar.', m: '2:05pm', hold: false },
    { t: 'Sent review request on a closed job', s: 'Three days after the water heater swap, with the photos attached.', m: '11:20am', hold: false }
  ];

  /* ---------- detail copy ---------- */
  var DETAILS = {
    leads: {
      title: 'New leads',
      what: 'Every inquiry that came in by form, call, text, or web chat, captured as a record instead of a missed voicemail.',
      bullets: [
        'Caller ID and web form fields parsed into name, address, and the job described',
        'Source tagged, so you can see which ads and listings actually produce work',
        'Duplicate check against existing customers before a second record is created'
      ],
      owner: 'Reply to it. A holding reply has already gone out, and a drafted answer waits for your OK.'
    },
    appts: {
      title: 'Appointments',
      what: 'Bookings confirmed against real tech availability, with reminders already scheduled.',
      bullets: [
        'Slots offered from the live calendar, not a static list',
        'Confirmation to the customer and the dispatch to the tech go out together',
        'Reminders at 24 hours and 2 hours, which is where no-shows get cut'
      ],
      owner: 'Approve a reschedule if it moves a job into overtime.'
    },
    followups: {
      title: 'Follow-ups',
      what: 'The queue of things that would otherwise be remembered at 11pm or not at all.',
      bullets: [
        'Quotes with no answer after 48 hours get a nudge',
        'Completed jobs get a review request on day three',
        'Seasonal maintenance reminders dated out months in advance'
      ],
      owner: 'Nothing, unless a reply needs a judgment call.'
    },
    approvals: {
      title: 'Pending approvals',
      what: 'The deliberate stopping point. Anything that spends money, commits a price, or speaks for the business in a new way waits for the owner.',
      bullets: [
        'Invoices and deposits above the threshold you set',
        'Quotes outside standard pricing',
        'Any message to a customer the system has not sent before'
      ],
      owner: 'One tap on a secure approval page.'
    },
    tasks: {
      title: 'Automated tasks',
      what: 'The running count of discrete administrative actions completed without the owner touching them.',
      bullets: [
        'One action means one thing a person would otherwise have had to do',
        'Logged individually, so the number can be audited rather than trusted',
        'Held and declined items are tracked separately and never counted here'
      ],
      owner: 'Nothing. This is the number that replaces "I was buried all week."'
    },
    hours: {
      title: 'Hours regained',
      what: 'Minutes saved per action, summed. Built from per-task handling-time estimates, not a marketing figure.',
      bullets: [
        'Each action type carries its own minute estimate, listed under every demo run',
        'Estimates come from timing the same tasks done by hand',
        'Conservative by design: partial-minute tasks round down'
      ],
      owner: 'Nothing, which is the point.'
    }
  };

  var STAGE_DETAIL = {
    new: { title: 'New lead', what: 'An inquiry exists and has been answered, but no conversation has happened yet.', bullets: ['Record created and acknowledged automatically', 'Owner notified with the one-line summary', 'Follow-up dated 24 hours out if the customer goes quiet'], owner: 'Nothing yet.' },
    contacted: { title: 'Contacted', what: 'Two-way contact made. The customer has replied or picked up.', bullets: ['Conversation thread attached to the record', 'Site visit or estimate offered', 'Stale after 5 days, which triggers a nudge'], owner: 'Take the call if they want to talk specifics.' },
    quote: { title: 'Quote', what: 'A price is out and the clock is running.', bullets: ['Quote logged with amount, scope, and expiry', 'Reminder at 48 hours, then at 7 days', 'Accepted quotes advance themselves to Scheduled'], owner: 'Set the price. Everything after it is handled.' },
    scheduled: { title: 'Scheduled', what: 'Work on the calendar with a tech assigned.', bullets: ['Customer confirmation and tech dispatch sent together', 'Parts-delay or conflict reschedules proposed, not silently made', 'Materials list generated from the accepted scope'], owner: 'Approve a reschedule when one is proposed.' },
    completed: { title: 'Completed', what: 'Job closed, invoiced, and followed up.', bullets: ['Final invoice drafted against the accepted amount, for you to send', 'Photos and notes filed to the job record', 'Review request and warranty follow-up scheduled'], owner: 'Send the final invoice from your own invoicing tool.' }
  };

  /* ---------- events ---------- */
  var EVENTS = [
    {
      id: 'new-lead',
      label: 'New Lead',
      who: 'Inbound text message, 7:12pm',
      msg: '"Water’s pouring out from under my kitchen sink. I shut the valve. Can anyone come tonight?"',
      stage: 'new',
      steps: [
        { what: 'Inquiry captured', how: 'Text parsed into a record: name, number, address, and the problem described.', min: 2 },
        { what: 'CRM record created', how: 'Checked against existing customers, flagged urgent on the shut-off valve detail.', min: 3 },
        { what: 'Holding reply sent', how: 'In 40 seconds: "Got it, we\u2019re reaching the owner now." It promises nothing, and it is the only thing that goes out on its own.', min: 1 },
        { what: 'Owner alerted right away', how: 'Marked urgent: name, address and the problem, so it is not waiting for the evening brief.', min: 1 },
        { what: 'Reply drafted, waiting for your OK', how: 'A tonight ETA, written in your voice. One tap sends it; you can edit it first.', min: 4 },
        { what: 'On-call tech lined up', how: 'Checked who is on call and prepared the dispatch with the address and an 8:40pm window. It goes out when you approve.', min: 6 },
        { what: 'Follow-up task created', how: 'Dated for the morning after, to confirm the repair held.', min: 2 }
      ],
      approvals: 1,
      log: { t: 'Emergency text picked up at 7:12pm', s: 'Holding reply sent in 40 seconds. ETA reply and tech dispatch ready for your one-tap OK.', hold: true }
    },
    {
      id: 'books',
      label: 'Customer Books',
      who: 'Booking link, 9:48am',
      msg: 'Hanley — water heater replacement, Thursday 8:00am, 412 Oakridge Ln.',
      stage: 'scheduled',
      steps: [
        { what: 'Appointment confirmed', how: 'Written to the calendar against real tech availability, not a static slot list.', min: 3 },
        { what: 'Confirmation sent to customer', how: 'Time, address, tech name, and what to expect on arrival.', min: 2 },
        { what: 'Tech assigned and notified', how: 'Route checked against the rest of the day so the truck is not crossing the county twice.', min: 4 },
        { what: 'Reminder sequence scheduled', how: '24 hours and 2 hours out. This is where no-shows get cut.', min: 3 },
        { what: 'Pipeline advanced to Scheduled', how: 'Record moved, dashboard updated, nothing re-entered by hand.', min: 2 }
      ],
      approvals: 0,
      log: { t: 'Booked and staffed a water heater swap', s: 'Thursday 8am, tech notified, reminders queued.', hold: false }
    },
    {
      id: 'accepted',
      label: 'Estimate Accepted',
      who: 'Email reply, 4:38pm',
      msg: '"Looks good — let’s get it on the schedule."  Whole-house repipe, $18,500.',
      stage: 'scheduled',
      steps: [
        { what: 'Quote marked accepted', how: 'Amount, scope, and acceptance date written to the record.', min: 2 },
        { what: 'Deposit invoice prepared', how: '$1,850 at 10%. Drafted, not sent — this one needs you.', min: 7, gate: true },
        { what: 'Job record created', how: 'Scope broken into tasks, materials list generated, duration estimated.', min: 8 },
        { what: 'Owner notified', how: 'Accepted amount, the deposit waiting for approval, and the proposed start date.', min: 1 },
        { what: 'Pipeline advanced to Scheduled', how: 'Moved out of Quote, dashboard and forecast both updated.', min: 3 }
      ],
      approvals: 1,
      log: { t: 'Processed an accepted repipe estimate', s: '$18,500 accepted. Job built, deposit invoice held for your yes.', hold: true }
    },
    {
      id: 'completed',
      label: 'Job Completed',
      who: 'Crew app, 3:26pm',
      msg: 'Hanley repipe marked complete. 14 photos uploaded, 2 notes.',
      stage: 'completed',
      steps: [
        { what: 'Job marked complete', how: 'Closed against the accepted scope, tech hours logged.', min: 2 },
        { what: 'Final invoice drafted', how: 'Reconciled against the quote and the deposit already paid. You send it from your own invoicing tool.', min: 7, gate: true },
        { what: 'Photos and notes filed', how: '14 photos attached to the job record, named and dated for the warranty file.', min: 5 },
        { what: 'Review request sent', how: 'Scheduled for day three, with two of the photos attached.', min: 3 },
        { what: 'Annual service reminder scheduled', how: 'Dated 11 months out for the water heater flush and a fixture check.', min: 4 },
        { what: 'Pipeline advanced to Completed', how: 'Record closed and dashboard updated.', min: 2 }
      ],
      approvals: 1,
      log: { t: 'Closed out the Hanley repipe', s: 'Final invoice drafted for you; photos filed, review request and service reminder queued.', hold: true }
    }
  ];

  /* ---------- rendering ---------- */
  var elMetrics = document.getElementById('metrics');
  var elPipe = document.getElementById('pipe');
  var elAct = document.getElementById('activity');
  var elTriggers = document.getElementById('triggers');
  var elRunner = document.getElementById('runner');
  var elDetailHost = document.getElementById('detail-host');

  function fmt(m) {
    if (m.dec) return m.v.toFixed(m.dec);
    return String(m.v);
  }

  function renderMetrics() {
    elMetrics.textContent = '';
    metrics.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'metric';
      b.setAttribute('data-key', m.key);
      b.innerHTML = '<span class="k"></span><span class="v"></span><span class="d"></span>';
      b.querySelector('.k').textContent = m.k;
      b.querySelector('.v').textContent = fmt(m);
      b.querySelector('.d').textContent = m.d;
      b.addEventListener('click', function () { showDetail(DETAILS[m.key], 'Metric'); });
      elMetrics.appendChild(b);
    });
  }

  function renderPipe() {
    elPipe.textContent = '';
    stages.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'stage';
      b.setAttribute('data-stage', s.key);
      b.innerHTML = '<span class="n"></span><span class="c"></span>';
      b.querySelector('.n').textContent = s.n;
      b.querySelector('.c').textContent = String(s.c);
      b.addEventListener('click', function () { showDetail(STAGE_DETAIL[s.key], 'Pipeline stage'); });
      elPipe.appendChild(b);
    });
  }

  function renderActivity() {
    elAct.textContent = '';
    activity.slice(0, 5).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'act-row';
      var badge = '<span class="handled' + (a.hold ? ' hold' : '') + '">' + (a.hold ? 'held' : 'handled') + '</span>';
      b.innerHTML = '<span class="act-t">' + badge + '<span class="t-text"></span></span>' +
                    '<span class="act-m"></span><span class="act-s"></span>';
      b.querySelector('.t-text').textContent = a.t;
      b.querySelector('.act-m').textContent = a.m;
      b.querySelector('.act-s').textContent = a.s;
      b.addEventListener('click', function () {
        showDetail({
          title: a.t,
          what: a.s,
          bullets: a.hold
            ? ['Drafted in full, then stopped before sending', 'Waiting on a yes or no from the owner', 'Auto-declines if there is no answer, rather than guessing']
            : ['Completed end to end with no owner involvement', 'Logged as a discrete action in the monthly count', 'Every message sent is kept on the customer record'],
          owner: a.hold ? 'One reply.' : 'Nothing.'
        }, 'Activity');
      });
      elAct.appendChild(b);
    });
  }

  function renderTriggers() {
    elTriggers.textContent = '';
    EVENTS.forEach(function (ev) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'trigger';
      b.textContent = ev.label;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('data-ev', ev.id);
      b.addEventListener('click', function () { run(ev); });
      elTriggers.appendChild(b);
    });
  }

  function setPressed(id) {
    var all = elTriggers.querySelectorAll('.trigger');
    for (var i = 0; i < all.length; i++) {
      all[i].setAttribute('aria-pressed', all[i].getAttribute('data-ev') === id ? 'true' : 'false');
    }
  }

  function bump(key) {
    var el = elMetrics.querySelector('.metric[data-key="' + key + '"]');
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function setMetric(key, delta) {
    for (var i = 0; i < metrics.length; i++) {
      if (metrics[i].key === key) {
        metrics[i].v = Math.round((metrics[i].v + delta) * 10) / 10;
        var el = elMetrics.querySelector('.metric[data-key="' + key + '"] .v');
        if (el) el.textContent = fmt(metrics[i]);
        bump(key);
        return;
      }
    }
  }

  function hotStage(key) {
    var all = elPipe.querySelectorAll('.stage');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('hot');
    var target = elPipe.querySelector('.stage[data-stage="' + key + '"]');
    if (!target) return;
    target.classList.add('hot');
    for (var j = 0; j < stages.length; j++) {
      if (stages[j].key === key) {
        stages[j].c += 1;
        target.querySelector('.c').textContent = String(stages[j].c);
      }
    }
  }

  /* ---------- the run ---------- */
  var running = false;

  function run(ev) {
    if (running) return;
    running = true;
    setPressed(ev.id);
    closeDetail();

    var total = 0;
    ev.steps.forEach(function (s) { total += s.min; });

    elRunner.textContent = '';

    var inbound = document.createElement('div');
    inbound.className = 'inbound';
    inbound.innerHTML = '<span class="who"></span><span class="msg"></span>';
    inbound.querySelector('.who').textContent = ev.who;
    inbound.querySelector('.msg').textContent = ev.msg;
    elRunner.appendChild(inbound);

    var panel = document.createElement('div');
    panel.className = 'panel';
    var ol = document.createElement('ol');
    ol.className = 'steps';
    ol.setAttribute('aria-live', 'polite');
    panel.appendChild(ol);
    elRunner.appendChild(panel);

    var nodes = ev.steps.map(function (s, i) {
      var li = document.createElement('li');
      if (s.gate) li.className = 'gate';
      li.innerHTML = '<span class="num"></span><span class="what"></span><span class="min"></span><span class="how"></span>';
      li.querySelector('.num').textContent = String(i + 1).padStart(2, '0');
      li.querySelector('.what').textContent = s.what;
      li.querySelector('.min').textContent = s.min + ' min';
      li.querySelector('.how').textContent = s.how;
      ol.appendChild(li);
      return li;
    });

    var step = 0;
    function next() {
      if (step >= nodes.length) { finish(); return; }
      nodes[step].classList.add('in');
      step++;
      if (reduce) { next(); } else { setTimeout(next, 620); }
    }

    function finish() {
      hotStage(ev.stage);
      setMetric('tasks', ev.steps.length);
      setMetric('hours', Math.round((total / 60) * 10) / 10);
      if (ev.id === 'new-lead') { setMetric('leads', 1); setMetric('followups', 1); }
      if (ev.id === 'books') setMetric('appts', 1);
      if (ev.approvals) setMetric('approvals', ev.approvals);
      if (ev.id === 'completed') setMetric('followups', 1);

      activity.unshift({ t: ev.log.t, s: ev.log.s, m: 'just now', hold: ev.log.hold });
      renderActivity();

      var tally = document.createElement('div');
      tally.className = 'tally';

      var rows = ev.steps.map(function (s) {
        return '<tr><td>' + s.what + '</td><td class="m">' + s.min + '</td></tr>';
      }).join('');

      tally.innerHTML =
        '<div class="tally-grid">' +
          '<div><span class="t-k">Actions completed</span><span class="t-v">' + ev.steps.length + '</span></div>' +
          '<div><span class="t-k">Owner actions required</span><span class="t-v' + (ev.approvals ? '' : ' zero') + '">' + ev.approvals + '</span></div>' +
          '<div><span class="t-k">Minutes regained</span><span class="t-v">' + total + '</span></div>' +
        '</div>' +
        '<details class="math"><summary>How the minutes are counted</summary>' +
          '<div class="math-body">' +
            '<div class="table-scroll"><table class="mins">' +
              '<thead><tr><th>Action</th><th class="m">Min</th></tr></thead>' +
              '<tbody>' + rows +
              '<tr class="sum"><td>Total</td><td class="m">' + total + '</td></tr></tbody>' +
            '</table></div>' +
            '<p class="note">Per-action estimates reflect the time the same task takes done by hand, including the context switch to go do it. Partial minutes round down.</p>' +
          '</div>' +
        '</details>';

      elRunner.appendChild(tally);

      var controls = document.createElement('div');
      controls.className = 'triggers';
      var reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'ghost';
      reset.textContent = 'Reset the demo';
      reset.addEventListener('click', resetAll);
      controls.appendChild(reset);
      elRunner.appendChild(controls);

      running = false;
    }

    next();
  }

  function resetAll() {
    metrics = [
      { key: 'leads', k: 'New leads', v: 12, d: 'this week' },
      { key: 'appts', k: 'Appointments', v: 9, d: 'booked, next 7 days' },
      { key: 'followups', k: 'Follow-ups', v: 6, d: 'queued and dated' },
      { key: 'approvals', k: 'Pending approvals', v: 1, d: 'waiting on the owner' },
      { key: 'tasks', k: 'Automated tasks', v: 214, d: 'completed this month' },
      { key: 'hours', k: 'Hours regained', v: 41.5, d: 'this month', dec: 1 }
    ];
    stages = [
      { key: 'new', n: 'New lead', c: 4 },
      { key: 'contacted', n: 'Contacted', c: 5 },
      { key: 'quote', n: 'Quote', c: 3 },
      { key: 'scheduled', n: 'Scheduled', c: 9 },
      { key: 'completed', n: 'Completed', c: 27 }
    ];
    activity = [
      { t: 'Answered a 7:12pm emergency text', s: 'Holding reply in 40 seconds. Owner tapped OK at 7:15pm; tonight ETA sent, on-call tech dispatched.', m: '7:12pm', hold: false },
      { t: 'Deposit invoice held for approval', s: '$1,850 on the Hanley repipe. Money-moving steps wait for a yes.', m: '4:38pm', hold: true },
      { t: 'Rescheduled Tuesday 9am for a parts delay', s: 'Moved two jobs, notified both customers and the tech, updated the calendar.', m: '2:05pm', hold: false },
      { t: 'Sent review request on a closed job', s: 'Three days after the water heater swap, with the photos attached.', m: '11:20am', hold: false }
    ];
    renderMetrics(); renderPipe(); renderActivity();
    setPressed('');
    closeDetail();
    elRunner.textContent = '';
    renderIdle();
    running = false;
  }

  function renderIdle() {
    var idle = document.createElement('div');
    idle.className = 'panel';
    idle.innerHTML = '<p class="note">Nothing running. Pick an event above and the workflow plays out step by step, with the minutes counted at the end.</p>';
    elRunner.appendChild(idle);
  }

  /* ---------- detail panel ---------- */
  function showDetail(d, kind) {
    if (!d) return;
    elDetailHost.textContent = '';
    var box = document.createElement('div');
    box.className = 'detail';
    box.setAttribute('tabindex', '-1');
    var bullets = (d.bullets || []).map(function (b) { return '<li></li>'; }).join('');
    box.innerHTML =
      '<div class="detail-head">' +
        '<div><div class="eyebrow">' + kind + '</div><h3></h3></div>' +
        '<button type="button" class="x" aria-label="Close details">Close</button>' +
      '</div>' +
      '<p class="kv what"></p>' +
      '<ul>' + bullets + '</ul>' +
      '<p class="kv"><strong>What the owner does:</strong> <span class="own"></span></p>';
    box.querySelector('h3').textContent = d.title;
    box.querySelector('.what').textContent = d.what;
    var lis = box.querySelectorAll('ul li');
    (d.bullets || []).forEach(function (b, i) { if (lis[i]) lis[i].textContent = b; });
    box.querySelector('.own').textContent = d.owner;
    box.querySelector('.x').addEventListener('click', closeDetail);
    elDetailHost.appendChild(box);
    elDetailHost.hidden = false;
    try { box.focus({ preventScroll: true }); } catch (e) {}
    try { elDetailHost.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) {}
  }

  function closeDetail() {
    elDetailHost.hidden = true;
    elDetailHost.textContent = '';
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !elDetailHost.hidden) closeDetail();
  });

  renderMetrics();
  renderPipe();
  renderActivity();
  renderTriggers();
  renderIdle();
})();
