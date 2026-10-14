(function(){
  "use strict";
  /* ------------------------------------------------------------------
     Paste the two links here once the accounts exist.

       SIGN_URL  the e-signature template link for the service agreement
       PAY_URL   the recurring payment link for the agreed plan

     While either is empty its button stays visibly disabled and the
     explanation underneath is shown instead, so a client never clicks a
     dead link and never sees a broken page.
     ------------------------------------------------------------------ */
  var SIGN_URL = "";
  var PAY_URL  = "";

  function wire(linkId, noteId, url){
    var a = document.getElementById(linkId), n = document.getElementById(noteId);
    if(!a) return;
    if(url){
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      if(n) n.hidden = true;
    } else {
      a.removeAttribute("href");
      a.setAttribute("aria-disabled","true");
      a.setAttribute("role","link");
    }
  }
  wire("sign-link","sign-pending",SIGN_URL);
  wire("pay-link","pay-pending",PAY_URL);

  var y = document.getElementById("yr2");
  if(y) y.textContent = String(new Date().getFullYear());
})();
