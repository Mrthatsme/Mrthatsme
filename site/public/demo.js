(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var state = { handled:47, hours:14.5, rows:[], asks:[], fixed:false };

  var seed = [
    {t:'7:09 PM', lane:'intake', k:'done', b:'Chat lead logged — Dana R.', s:'No hot water, south side. Answered in 40 seconds, in your words.'},
    {t:'6:48 PM', lane:'money',  k:'told', b:'Invoice #1182 paid — $680', s:'Alvarez, backflow test. Marked paid, receipt filed.'},
    {t:'6:30 PM', lane:'after',  k:'done', b:'Review requested — Alvarez', s:'Sent the day the job closed. One ask, no second.'},
    {t:'5:55 PM', lane:'after',  k:'done', b:'14 job photos filed', s:'Foldered by address and date, on the job record.'},
    {t:'5:20 PM', lane:'schedule',k:'told',b:'Tomorrow’s run sheet built', s:'3 jobs, 41 miles, gate code for the second stop.'},
    {t:'4:38 PM', lane:'intake', k:'done', b:'Out-of-area enquiry declined', s:'Two counties out. Polite decline drafted and sent, no time spent.'},
    {t:'3:15 PM', lane:'schedule',k:'done',b:'Confirmation sent — Weds 2pm', s:'Slab leak locate, Wednesday. Customer confirmed.'},
    {t:'11:02 AM',lane:'money',  k:'told', b:'Deposit logged — $500', s:'Water heater swap, scheduled Thursday.'},
    {t:'6:14 AM', lane:'schedule',k:'told',b:'Broken intake form repaired', s:'Their website renamed a field overnight. Caught and fixed before the first lead.'}
  ];
  state.rows = seed.slice();

  var seedAsks = [
    {lbl:'Quote, waiting on you', body:'<b>Dana R.</b> wants a water heater replaced. Drafted off your price list.', quote:'50 gal gas, haul-away, permit — $2,480. Tuesday or Thursday.'},
    {lbl:'Reschedule, waiting on you', body:'Rain forecast for <b>Thursday’s</b> slab leak locate.', quote:'"Storm’s coming through Thursday. Can we move you to Friday, same time?"'},
    {lbl:'Past-due reminder, waiting on you', body:'<b>Hendricks</b> — invoice #1184, 34 days out.', quote:'$1,240. Reminder drafted. We never run the card; you charge it.'}
  ];
  state.asks = seedAsks.slice();

  var crew = [
    {n:'The GM', role:'Routes the work, holds your rules, writes your brief. Checks every specialist’s output against what was asked before it counts as done. Decides nothing on its own.', m:'now', gm:true},
    {n:'Intake', role:'Answers and qualifies every new enquiry, day or night', m:'40s ago'},
    {n:'Schedule', role:'Confirmations, reminders, reschedules, no-shows, the run sheet', m:'8m ago'},
    {n:'Quotes', role:'Drafts estimates off your price list and chases the ones you sent', m:'12m ago'},
    {n:'Billing', role:'Invoice status, reminders, deposits. Never runs a card', m:'1h ago'},
    {n:'Aftercare', role:'Reviews, photos, callback windows, service reminders', m:'42m ago'},
    {n:'The Watch', role:'Re-runs every automation against what it was supposed to do, and calls it the moment one drifts', m:'06:14', fix:true},
    {n:'The Fixer', role:'Takes the break off the Watch, runs the known repair, and escalates only what it cannot mend', m:'06:16', fix:true}
  ];

  var triggers = [
    {id:'lead', label:'A lead lands at 9pm', sm:'website chat', run:function(){
      add({lane:'intake',k:'done',b:'Chat answered — Marcus T.', s:'Burst pipe under the kitchen sink. Replied in 38 seconds.'});
      add({lane:'intake',k:'done',b:'Lead logged in the CRM', s:'Name, number, address, what he needs. Top of tomorrow’s brief.'});
      add({lane:'intake',k:'told',b:'Flagged as emergency', s:'Outside hours and urgent, so it went straight to your on-call phone.'});
      ask({lbl:'Booking, waiting on you',body:'<b>Marcus T.</b> asked for the first slot tomorrow.',quote:'8am Wednesday is open. Confirm and he gets the confirmation.'});
    }},
    {id:'done', label:'A job gets marked complete', sm:'from the truck', run:function(){
      add({lane:'after',k:'done',b:'Review requested — Mason job', s:'Went out 6 minutes after the job closed.'});
      add({lane:'after',k:'done',b:'9 photos filed to the job', s:'Named and dated, in the customer’s folder.'});
      add({lane:'money',k:'told',b:'Invoice #1189 drafted — $2,480', s:'Line items pulled from the job. Waiting on your look.'});
      add({lane:'after',k:'told',b:'Callback window set', s:'Flag at 30 and 90 days while it’s under warranty.'});
    }},
    {id:'quote', label:'An estimate gets accepted', sm:'customer replies yes', run:function(){
      add({lane:'intake',k:'done',b:'Quote Chaser stood down', s:'Dana R. replied. Day 5 and day 10 follow-ups cancelled.'});
      add({lane:'schedule',k:'told',b:'Job placed — Thursday 10am', s:'Two hours blocked, 22 minutes of drive time either side.'});
      add({lane:'money',k:'told',b:'Deposit request drafted — $500', s:'We never run a card. You get told, you charge it.'});
    }},
    {id:'late', label:'An invoice hits 30 days', sm:'nobody chased it', run:function(){
      add({lane:'money',k:'told',b:'Invoice #1184 crossed 30 days', s:'Hendricks, $1,240. Moved to the top of the money board.'});
      ask({lbl:'Past-due reminder, waiting on you',body:'Second notice for <b>Hendricks</b>, drafted in your wording.',quote:'"Just circling back on invoice #1184 from last month — happy to take it over the phone."'});
    }},
    {id:'break', label:'Something quietly breaks', sm:'the part nobody sees', run:function(){
      add({lane:'schedule',k:'told',b:'Booking confirmations stopped firing', s:'Calendar app changed its permissions at 03:40. Caught on the next check.'});
      add({lane:'schedule',k:'told',b:'Handed to the Fixer', s:'The Watch opened a repair task. Known remedy: re-authorise, then replay what was missed.'});
      add({lane:'schedule',k:'done',b:'Reconnected and backfilled', s:'Fixed at 06:02. The two missed confirmations went out. No charge, and nobody had to notice.'});
      state.fixed = true;
    }}
  ];

  function nowLabel(){
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12; if(h === 0) h = 12;
    return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
  }
  function add(o){ o.t = nowLabel(); o.fresh = true; state.rows.unshift(o); state.handled++; state.hours = Math.round((state.hours + 0.2) * 10) / 10; }
  function ask(o){ o.fresh = true; state.asks.unshift(o); }

  var laneName = {intake:'Intake', schedule:'Schedule', money:'Money', after:'After the job'};
  var pillName = {done:'Handled', told:'Told you', ask:'Asked you', never:'Blocked'};
  var lane = 'all';

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  function renderRows(){
    var list = state.rows.filter(function(r){ return lane === 'all' || r.lane === lane; });
    var el = document.getElementById('rows');
    el.innerHTML = list.slice(0, 14).map(function(r){
      return '<li class="row' + (r.fresh ? ' new' : '') + '">' +
        '<span class="t">' + esc(r.t) + '</span>' +
        '<span class="m"><b>' + esc(r.b) + '</b><span>' + esc(r.s) + ' &middot; ' + laneName[r.lane] + '</span></span>' +
        '<span class="pill ' + r.k + '">' + pillName[r.k] + '</span></li>';
    }).join('');
    document.getElementById('boardCount').textContent = list.length + ' today';
    state.rows.forEach(function(r){ r.fresh = false; });
  }

  function renderAsks(){
    var el = document.getElementById('asks');
    if(!state.asks.length){
      el.innerHTML = '<li class="empty">Nothing waiting on you.<br>Everything else ran on the rules you set.</li>';
    } else {
      el.innerHTML = state.asks.map(function(a, i){
        return '<li class="ask-card' + (a.fresh ? ' new' : '') + '">' +
          '<span class="lbl">' + esc(a.lbl) + '</span>' +
          '<span class="body">' + a.body + '</span>' +
          '<span class="quote">' + esc(a.quote) + '</span>' +
          '<span class="acts"><button class="btn go" data-ok="' + i + '">Approve</button>' +
          '<button class="btn" data-no="' + i + '">Hold</button></span></li>';
      }).join('');
    }
    document.getElementById('askCount').textContent = state.asks.length ? state.asks.length + ' waiting' : 'clear';
    document.getElementById('kAsk').textContent = state.asks.length;
    document.getElementById('tileAsk').classList.toggle('flag', state.asks.length > 0);
    state.asks.forEach(function(a){ a.fresh = false; });
  }

  function renderHealth(){
    var el = document.getElementById('health');
    el.innerHTML = crew.map(function(h){
      return '<li class="hrow' + (h.gm ? ' gm' : '') + '"><span class="dot' + (h.fix ? ' fix' : '') + '"></span>' +
        '<span class="nm">' + esc(h.n) + '</span><span class="mt">' + esc(h.m) + '</span>' +
        '<span class="rl">' + esc(h.role) + '</span></li>';
    }).join('') + '<li class="fixnote">The Watch caught a renamed form field at 06:14. The Fixer re-mapped it by 06:16, before the first lead of the day, at no charge. Nobody had to notice.' +
      (state.fixed ? ' Calendar permissions repaired at 06:02 the same way.' : '') + '</li>';
  }

  function renderTiles(){
    document.getElementById('kHandled').textContent = state.handled;
    document.getElementById('kHours').textContent = state.hours.toFixed(1);
  }

  document.getElementById('trigs').innerHTML = triggers.map(function(t){
    return '<button class="tbtn" data-run="' + t.id + '">' + esc(t.label) + '<span class="sm">' + esc(t.sm) + '</span></button>';
  }).join('');

  document.getElementById('trigs').addEventListener('click', function(e){
    var b = e.target.closest('[data-run]'); if(!b) return;
    var t = triggers.filter(function(x){ return x.id === b.getAttribute('data-run'); })[0]; if(!t) return;
    b.disabled = true;
    t.run();
    lane = 'all';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(x){ x.setAttribute('aria-selected', x.dataset.lane === 'all'); });
    renderRows(); renderAsks(); renderHealth(); renderTiles();
    setTimeout(function(){ b.disabled = false; }, reduce ? 200 : 900);
  });

  document.querySelector('.tabs').addEventListener('click', function(e){
    var b = e.target.closest('.tab'); if(!b) return;
    lane = b.dataset.lane;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(x){ x.setAttribute('aria-selected', x === b); });
    renderRows();
  });

  document.getElementById('asks').addEventListener('click', function(e){
    var ok = e.target.closest('[data-ok]'), no = e.target.closest('[data-no]');
    if(!ok && !no) return;
    var i = parseInt((ok || no).getAttribute(ok ? 'data-ok' : 'data-no'), 10);
    var a = state.asks[i]; if(!a) return;
    state.asks.splice(i, 1);
    if(ok){ add({lane:'intake', k:'done', b:'Approved and sent', s:a.lbl.replace(/,.*$/, '') + ' — went out in your words, seconds after you said yes.'}); }
    else { add({lane:'intake', k:'told', b:'Held for you', s:a.lbl.replace(/,.*$/, '') + ' — parked. Nothing sent, nothing lost.'}); }
    renderRows(); renderAsks(); renderTiles();
  });

  document.getElementById('clock').textContent = nowLabel();
  renderRows(); renderAsks(); renderHealth(); renderTiles();
})();
