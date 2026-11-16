(function () {
  'use strict';
  var form = document.getElementById('setup'), err = document.getElementById('err');
  var token = new URLSearchParams(location.search).get('token') || '';
  // keep the token out of the address bar and history once we've read it
  if (token && history.replaceState) history.replaceState(null, '', '/portal/setup');
  MR.api('/setup?token=' + encodeURIComponent(token), { noRedirect: true }).then(function (d) {
    document.getElementById('who').textContent = 'Signing in as ' + d.email + (d.business ? ' for ' + d.business : '') + '.';
  }).catch(function (x) {
    MR.msg(err, x.message);
    form.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = MR.formData(form), btn = form.querySelector('button');
    if ((d.password || '').length < 10) return MR.msg(err, 'Use at least 10 characters.');
    if (d.password !== d.confirm) return MR.msg(err, "Those two passwords don't match.");
    btn.disabled = true; btn.textContent = 'Saving…';
    MR.api('/setup', { method: 'POST', body: { token: token, password: d.password }, noRedirect: true }).then(function (r) {
      location.replace(r.role === 'admin' ? '/portal/admin' : '/portal/app');
    }).catch(function (x) { MR.msg(err, x.message); btn.disabled = false; btn.textContent = 'Save and sign in'; });
  });
})();
