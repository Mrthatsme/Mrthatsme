(function(){
  var mail = [
    {who:'Ferguson Supply', subj:'Re: Order 88214 — backorder notice', tag:'you',
     act:'<b>Left for you.</b> The 50-gallon units slip two weeks. Three scheduled jobs depend on them, so this is a decision, not a reply.'},
    {who:'Dana Rutherford', subj:'Question about the quote you sent', tag:'draft',
     act:'<b>Drafted, sitting in your Drafts.</b> "Happy to walk through it — the permit and haul-away are included, the only variable is if the shutoff needs replacing." Send it or change it.'},
    {who:'Clay County Permits', subj:'Inspection scheduled — 118 Rowan St', tag:'filed',
     act:'<b>Filed to the job.</b> Friday 9am added to your calendar, confirmation saved to the Rowan St folder.'},
    {who:'Marcus Hendricks', subj:'Invoice 1184 — sorry for the delay', tag:'you',
     act:'<b>Left for you.</b> He is asking to split it over two payments. Money terms are yours, never ours.'},
    {who:'Apprentice applicant', subj:'Re: Following up on my application', tag:'draft',
     act:'<b>Drafted and booked.</b> Thursday 3:30 offered and accepted. Resume saved to your hiring folder.'},
    {who:'47 others', subj:'Newsletters, receipts, delivery notices, spam', tag:'filed',
     act:'<b>Filed or binned.</b> Receipts attached to the right jobs. Nothing that needed a human.'}
  ];
  var tagName = {filed:'Filed', draft:'Drafted', you:'Needs you'};
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  document.getElementById('mail').innerHTML = mail.map(function(m, i){
    return '<li class="mi"><button class="openbtn" aria-expanded="false" data-i="' + i + '">' +
      '<span class="who">' + esc(m.who) + '</span><span class="subj">' + esc(m.subj) + '</span></button>' +
      '<span class="tag ' + m.tag + '">' + tagName[m.tag] + '</span>' +
      '<span class="act" hidden>' + m.act + '</span></li>';
  }).join('');

  document.getElementById('mail').addEventListener('click', function(e){
    var b = e.target.closest('.openbtn'); if(!b) return;
    var act = b.parentNode.querySelector('.act');
    var open = !act.hidden; act.hidden = open; b.setAttribute('aria-expanded', String(!open));
  });

  var tasks = [
    {nm:'Clean up the contact list', de:'1,840 records down to 1,512. Duplicates merged, 94 dead numbers flagged.', st:'done', mt:'2.1 hrs'},
    {nm:'Last quarter’s receipts', de:'Sorted and attached to jobs before your accountant asks for them.', st:'done', mt:'1.4 hrs'},
    {nm:'New apprentice setup', de:'Email, calendar, phone and job app. Ready for his first day Monday.', st:'run', mt:'in progress'},
    {nm:'Warranty letter template', de:'Drafted. Waiting on you to confirm the terms before it goes in the folder.', st:'run', mt:'waiting on you'}
  ];
  var suggestions = [
    'Reschedule next week, the van is in the shop',
    'Chase Ferguson for a real delivery date',
    'Pull together last month’s job costs',
    'Clear the inbox back to September'
  ];

  function renderTasks(){
    document.getElementById('tasks').innerHTML = tasks.map(function(t){
      return '<li class="tk ' + t.st + (t.fresh ? ' new' : '') + '"><span class="hd"><span class="nm">' + esc(t.nm) +
        '</span><span class="mt">' + esc(t.mt) + '</span></span><span class="de">' + esc(t.de) + '</span></li>';
    }).join('');
    var open = tasks.filter(function(t){ return t.st !== 'done'; }).length;
    document.getElementById('tkCount').textContent = open + ' in flight';
    tasks.forEach(function(t){ t.fresh = false; });
  }

  function handOver(text){
    var v = String(text || '').trim(); if(!v) return;
    if(v.length > 90) v = v.slice(0, 90);
    tasks.unshift({nm:v, de:'Picked up. We will come back with a time estimate before anything takes real hours.', st:'run', mt:'just now', fresh:true});
    renderTasks();
    document.getElementById('newTask').value = '';
  }

  document.getElementById('chips').innerHTML = suggestions.map(function(s){
    return '<button class="chip" type="button">' + esc(s) + '</button>';
  }).join('');
  document.getElementById('chips').addEventListener('click', function(e){
    var c = e.target.closest('.chip'); if(c) handOver(c.textContent);
  });
  document.getElementById('addTask').addEventListener('click', function(){
    handOver(document.getElementById('newTask').value);
  });
  document.getElementById('newTask').addEventListener('keydown', function(e){
    if(e.key === 'Enter') handOver(this.value);
  });

  renderTasks();
})();
