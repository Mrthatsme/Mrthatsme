(function () {
  'use strict';
  var form = document.getElementById('login'), err = document.getElementById('err');
  // already signed in? skip the form
  MR.api('/me', { noRedirect: true }).then(function (d) {
    location.replace(d.user.role === 'admin' ? '/portal/admin' : '/portal/app');
  }).catch(function () {});
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = MR.formData(form), btn = form.querySelector('button');
    if (!d.email || !d.password) return MR.msg(err, 'Enter your email and password.');
    btn.disabled = true; btn.textContent = 'Signing in…';
    MR.api('/login', { method: 'POST', body: d, noRedirect: true }).then(function (r) {
      location.replace(r.role === 'admin' ? '/portal/admin' : '/portal/app');
    }).catch(function (x) {
      MR.msg(err, x.message); btn.disabled = false; btn.textContent = 'Sign in';
    });
  });
})();
