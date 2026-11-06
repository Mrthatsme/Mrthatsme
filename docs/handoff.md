# Handoff — minutesregained.com

Last updated: November 6, 2026. Branch: `claude/virtual-service-startup-32flre`.
The site is a Cloudflare Worker in `site/`. A push to this branch deploys in about a minute.

**This repo is public.** Keep business-internal material out of it: margins, labour costs, legal and
attorney matters, client details and anything personal. Those live in the Shared Drive.

The site rules are `CLAUDE.md` at the repo root and `docs/build-spec.md`, with reference mockups in `mockups/`.
Two documents from the same package are deliberately not in this repo: the open decisions and the internal ops notes.
They are in the Shared Drive, folder 03 Operations & Automations.

---

## Finished

### The /start agreement fix
- `minutesregained.com/agreement` shows the full agreement as plain server HTML, with no script and no login.
  It covers every plan and billing option and carries a draft notice. Code: `site/src/agreementpage.js`.
- `/start` arrives with the chosen plan's agreement already in the panel. A link to that plan's `/agreement`
  page sits above the panel and the checkbox. Other plans load with a 10-second limit, and if that fails the
  message links to `/agreement`.
- **Sign-ups are closed on the server.** `/api/agree` and `/api/checkout` return 403 unless the Worker
  variable `SIGNUPS_OPEN` is `"true"`. While closed, `/start` shows the hold notice and a Book a call button
  in place of the sign and pay steps.

### Plans as published
- **Essential** $450, 4 hours a month. **Business Support** $900, 8 hours. Extra hours $75 an hour on both,
  only with written approval.
- **Custom Automation** from $550, dropping to $250 once the build is paid off, on a 12-month term. Book a call only.
- **Operations+ is retired.**
- The five automations: **Lead Catcher, Quote Chaser, Schedule Keeper, Review Builder, Invoice & Chase**, plus
  **The Daily Brief** with every plan.
- Online agreement version **2026-11-06.2** (`site/src/contract.js`; plan data in `site/src/plans.js`).

### The design (first built as one long homepage, now split across five pages; see below)
- Rebuilt from `mockups/homepage.html` in the brand colours and fonts (`landing.css`; the calculator is `landing.js`).
- **FAQ and automation names are in the server HTML.**
  - The 11 FAQs are `<details class="faq-item">` blocks with the full answer text, now spread across Home, Services and Pricing.
  - The search box (Services only) filters them with `el.hidden` and only appears when script runs.
  - FAQPage JSON-LD is built from the same content.
- **Proof slots stay empty until earned:** review strip, hidden testimonial block, hidden result lines and footer badge slots.
- **Phone `(877) 896-8784`** is a tappable link in the header of every public page.
- **Tested:** every public page at 375px and 1280px with no sideways scroll.

### The five-page split (November 6)
- The long homepage is now five pages, with the menu **Home · Services · Pricing · Industries · About** plus the phone link
  and Book a call on every one. Section copy was moved, not rewritten.
  - **Home** `/`: hero, Bring us the thing, a strip of the five automation names linking to `/services`, Who this is for
    (linking to the industry pages), a "Plans from $450" teaser, How it starts, one FAQ, Book a call.
  - **Services** `/services`: the five automations in full (each has an anchor, e.g. `/services#quote-chaser`), a person
    for everything that needs judgment, the permission dial and never-list, your tools, the demo strip linking to both demos,
    six FAQs with the search box.
  - **Pricing** `/pricing`: calculator, the three cards, hold notice, a side-by-side table (plans as columns so it fits a
    phone), Custom Automation scopes, fine print with the `/agreement` link, four FAQs.
  - **Industries** `/for/` is a new index. `/for/contractors` and `/for/law-firms` are rebuilt in the new design and are
    now **indexed** (they were `noindex`). Their message forms are gone and the founding offer is no longer repeated there.
  - **About** `/about`: Jerome's bio, the one-person question, the NDA line, and the only message form on the site.
- Each page has its own title, description, H1, canonical and FAQPage JSON-LD. `sitemap.xml` lists all of them plus the demos.
- On a phone the menu sits on its own row under the logo (the old header hid it below 460px). Under 380px the wordmark is
  visually hidden so the number and Book a call stay on the first row.
- Old one-page links such as `/#pricing`, `/#faq` and `/#who` are sent to the new page by `site.js`.
- `404.html` and `privacy.html` (old design) have the new menu. `/start` "Back to pricing" goes to `/pricing`.
- **CSP:** the JSON-LD hash in `_headers` never matched, so browsers were blocking the homepage's structured data.
  All six JSON-LD blocks are now allowed by hash.
- **`site/tools/check_site.py`** checks menus, phone links, one H1, unique titles and descriptions, FAQ JSON-LD against the
  visible questions, the five names in the HTML, sitemap entries and CSP hashes. `--fix` rewrites the hashes.
  Run it before every push that touches a page.
- Tested in Chromium at 360, 375, 390, 414, 768, 1024 and 1280px: no sideways scroll, no broken internal links,
  calculator and FAQ search working, old anchors redirecting.

### Texting, settled (was bug 1)
- Jerome, November 6: nothing is ever texted from a number of ours. A text only goes out through the client's own software
  when it already has messaging built in (Jobber or Housecall Pro texting crews, or a Facebook or Instagram inbox the
  customer wrote to first). Recorded in `CLAUDE.md`. The Services never-list, `/for/contractors`, `/for/law-firms` and the
  triage agent's FAQ (`site/src/faq-data.js`) all say this now.

### Fixes from the outside review (November 6)
An outside "customer-perspective" review was written against an older version of the site. Most of it was already handled.
Four points were still fair and are now fixed:
- **Hours are a person's time.** Said plainly on `/pricing` and in the Services hours note; the hours FAQ adds "even when AI
  tools help get it done faster".
- **When something breaks** it shows in the daily brief with what failed. "Often before you notice" is gone.
- **We don't answer the phone.** Said on the Lead Catcher card and in a new Services FAQ ("Do you answer our phones?").
- **Opt-out.** The never-list and `CLAUDE.md` now say no message ever goes to anyone who asked to stop. The contractors FAQ
  says a STOP reply ends it. The system must actually honour this before any text goes out through a client's app.
The triage agent's FAQ (`site/src/faq-data.js`) matches all four. Still open from the review: an interactive demo, real proof
from pilot clients, and a written security summary. The review liked "We build it. We run it. We watch it."; it is no longer
on any public page (only inside the `/demo-desk` sample), so bring it back only if Jerome wants it.

### The two demo pages
- `/demo` is the back-office demo and `/demo-desk` the admin-desk demo, built from the mockups.
  Files: `site/public/demo.*` and `demo-desk.*`, with CSS and JS kept out of the HTML for the security policy.
- Both carry the sample-data label, the site bar with the phone number and Book a call, and links to each other.
  The homepage's "Open the full demo" opens `/demo`.
- The admin desk's hours panel uses the new 8-hour Business Support plan (5.2 of 8 used).

Commits, oldest first: `048377f`, `9115f42`, `101774c`, `37df6f5`, `2ac8142`, `acb2fc4`, `0a394d6`, then the package and demo commits.

---

## In progress
- **Founding client offer.** Still published as Business Support at $450 for the first 90 days. It is under review.

---

## Open bugs and loose ends
1. ~~Texting~~: settled, see above.
2. **Daily Brief timing.** Services says "one screen every morning"; the industry pages' Daily Brief cards say "one summary of the day"
   (the "6:00 PM" label was taken off their sample briefs). The Worker sends the internal brief at 8 AM and 8 PM. Pick one wording.
3. **Calculator never suggests Essential.** Its plan thresholds are in `site/public/landing.js` (`CALC.plans`). They need setting.
4. ~~Demo strip count~~: now says one waiting on a decision, which matches what it shows.
5. ~~Industry pages in the old design~~: rebuilt in the split.
6. **Unused files:** `site/public/home.js`, `site/public/home.css` (only the old industry pages used it) and the old demo's `demo-video.mp4` and `demo-poster.jpg` are no longer used by any page.
   The Worker still has a `/demo-video.mp4` route.
7. **Where the site doesn't use the spec's exact copy:**
   - Calculator basis line: no "typical" result claimed.
   - Retainer refund example: $3,060, which matches the agreement.
   - Demo label: adds "or a client result".
   - Additions: four extra FAQs, the no-passwords line in the tools section, the message form beside the closing call to action.
8. **Payments are in Stripe test mode.** Nothing to do until sign-ups open.
9. **The triage agent's FAQ says "roughly one to twenty-five people"** (`site/src/faq-data.js`, "How big does my business need to be?").
   The site says ten to fifty. Pick one and make them match.
10. **Old-design utility pages:** `/access`, `/client` and `/start` still use `site.css` with a short header (phone + Book a call),
    and `/demo` and `/demo-desk` keep their own site bar. They don't carry the five-page menu. Fine for now; restyle when convenient.

---

## Key decisions
- Sign-ups stay read-only until the service agreement is countersigned.
- **Keep the demo, and keep it easy to find** (Jerome, November 6): "if I can't see what I'm paying for, why do it."
  Home has a See it running button in the hero and the demo strip after "Bring us the thing". Pricing and every
  Book a call band link to `/demo`. Don't remove or bury the demos in future edits.
- Operations+ retired. Automations renamed (above). Plan hours and extra-hour rate set as above.
- The site names the owner, Jerome, with no photo. No location line, and nothing beyond the bio copy.
- The pitch leads with "you don't hand us your passwords, and there's nothing to install".
- Standing rules:
  - No invented proof: testimonials, client names, logos or outcome numbers.
  - Label every sample screen.
  - Customer-facing email goes to support@minutesregained.com only.

---

## Next steps
1. **Settle the founding client offer** (Jerome's numbers). Then update every place that names it: the Business Support card on `/pricing`,
   `/start`, `site/src/plans.js`, and the agreement version.
2. **Fix open bug 2** (Daily Brief timing) **and bug 9** (business size in the agent's FAQ), then remove the unused files in bug 6
   and the Worker's `/demo-video.mp4` route.
3. **Set the calculator thresholds** (bug 3) so it can suggest Essential.
4. **A demo people can try** (from the outside review): a visitor types a made-up request and watches it go through intake,
   the Ask Me approval, and into the daily brief, all on sample data and clearly labelled. Plan it with Jerome first.

## Starting a new session
Open a new session on branch `claude/virtual-service-startup-32flre` and say:
"Read CLAUDE.md and docs/handoff.md. Show me the plan for next step 1 before changing anything."
Everything needed is in those two files; the Shared Drive holds the internal documents.

When the reviewed agreement comes back: apply the changes in `site/src/contract.js` (bump the version) and get it countersigned.
Then set `SIGNUPS_OPEN = "true"` in the Worker's variables and switch Stripe to live keys.
