(function(){
  "use strict";
  /* ------------------------------------------------------------------
     PORTAL_URL is the Stripe customer portal login link (Stripe Dashboard >
     Settings > Billing > Customer portal). Clients sign in with their
     email and a one-time code; we never handle their card details.

     While it is empty the button stays visibly disabled and the
     explanation underneath is shown instead, so a client never clicks a
     dead link.
     ------------------------------------------------------------------ */
  var PORTAL_URL = "";

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
  wire("pay-link","pay-pending",PORTAL_URL);

  var y = document.getElementById("yr2");
  if(y) y.textContent = String(new Date().getFullYear());
})();
