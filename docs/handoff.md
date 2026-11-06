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

### Homepage
- Rebuilt from `mockups/homepage.html` in the brand colours and fonts (`site/public/index.html`, `landing.css`, `landing.js`).
- Sections follow the order in `docs/build-spec.md`.
- **FAQ and automation names are in the server HTML.**
  - The FAQ is 11 `<details class="faq-item">` blocks with the full answer text.
  - The search box filters them with `el.hidden` and only appears when script runs.
  - FAQPage JSON-LD is built from the same content.
- **Proof slots stay empty until earned:** review strip, hidden testimonial block, hidden result lines and footer badge slots.
- **Phone `(877) 896-8784`** is a tappable link in the header of every public page.
- **Tested:** every public page at 375px and 1280px with no sideways scroll.

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
1. **Texting.** `/for/contractors` says crews can get their schedule "by text through your own scheduling app".
   The never-list says the system never sends a text message. Decide which is true and fix the page.
2. **Daily Brief timing.** The homepage says "one screen every morning"; older pages say evening or 6:00 PM. Pick one wording.
3. **Calculator never suggests Essential.** Its plan thresholds are in `site/public/landing.js` (`CALC.plans`). They need setting.
4. **Demo strip count.** It says "three waiting on a decision" but shows one waiting item (sample data).
5. **Industry pages are in the old design** (`/for/contractors`, `/for/law-firms`). On a phone their header button wraps to a second row.
6. **Unused files:** `site/public/home.js` and the old demo's `demo-video.mp4` and `demo-poster.jpg` are no longer used by any page.
   The Worker still has a `/demo-video.mp4` route.
7. **Where the site doesn't use the spec's exact copy:**
   - Calculator basis line: no "typical" result claimed.
   - Retainer refund example: $3,060, which matches the agreement.
   - Demo label: adds "or a client result".
   - Additions: four extra FAQs, the no-passwords line in the tools section, the message form beside the closing call to action.
8. **Payments are in Stripe test mode.** Nothing to do until sign-ups open.

---

## Key decisions
- Sign-ups stay read-only until the service agreement is countersigned.
- Operations+ retired. Automations renamed (above). Plan hours and extra-hour rate set as above.
- The site names the owner, Jerome, with no photo. No location line, and nothing beyond the bio copy.
- The pitch leads with "you don't hand us your passwords, and there's nothing to install".
- Standing rules:
  - No invented proof: testimonials, client names, logos or outcome numbers.
  - Label every sample screen.
  - Customer-facing email goes to support@minutesregained.com only.

---

## Next 3 steps
1. **Settle the founding client offer.** Then update every place that names it: homepage card, `/pricing`, `/start`,
   `site/src/plans.js`, and the agreement version.
2. **Fix open bugs 1 and 2** (texting wording on `/for/contractors`, Daily Brief timing). They are copy contradictions a prospect could notice.
3. **Bring the industry pages (`/for/contractors`, `/for/law-firms`) and `/pricing` in line with the new homepage design**,
   then remove the unused files in bug 6.

## Starting a new session
Open a new session on this branch and say: "Read CLAUDE.md and docs/handoff.md, then start on next step 1."
Everything needed is in those two files; the Shared Drive holds the internal documents.

When the reviewed agreement comes back: apply the changes in `site/src/contract.js` (bump the version) and get it countersigned.
Then set `SIGNUPS_OPEN = "true"` in the Worker's variables and switch Stripe to live keys.
