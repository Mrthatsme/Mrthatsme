# Minutes Regained — project rules

Read this before changing anything on the site.

## What this is

Minutes Regained is a one-person business selling virtual assistant support **and**
automation to small businesses, centre of gravity around 10–50 employees. Operated by
Provident Watch LLC. The site is minutesregained.com.

The offer has two halves and the copy must always carry both:

- **Automations** handle work that happens the same way every time. Built in the client's
  own accounts, monitored daily, repaired free.
- **A person** handles the work that needs judgement. Inbox, calendar, documents,
  one-off jobs. That half never goes away.

The model sentence, which appears on the homepage and should never be contradicted:
*a person does it first so you can watch it done your way, then the parts that repeat
become automations, and the hours go back to the things that actually need a human.*

## Hard rules

**Never invent proof.** No testimonials, client names, logos, review counts, case studies
or outcome statistics. There are no clients yet. Empty proof slots stay empty with their
honest placeholder text. This is not negotiable even if a section "looks empty".

**Label every example.** Any demo, sample screen or illustrative number carries a visible
line saying it is sample data for an example company and that no figure is a client result.

**Never claim an integration that hasn't been verified.** Confirmed via Zapier today:
Jobber (11 triggers, 8 actions), ServiceTitan (large trigger/action set), Housecall Pro
(2 Zapier triggers plus 41 webhook events, needs their MAX plan for webhooks), Workiz,
FieldPulse. Google Workspace, Microsoft 365, QuickBooks and Xero are connected by being
added as a user. Anything else is "we check it on the assessment call."

**The never-list is product truth, not marketing.** It appears on the homepage and the
system must actually behave this way:
- Never sends a text from a number of ours. Replies happen where the customer reached out. A text only goes out
  through the client's own software when it already has messaging built in, like a scheduling app (Jobber,
  Housecall Pro) that texts crews, or a Facebook or Instagram inbox the customer wrote to first. Which of a
  client's tools can do that is confirmed on the assessment call (Jerome, November 6, 2026).
- Never quotes a price, promises a date, or messages anyone who didn't make contact first, or anyone who has asked to
  stop (a STOP reply or any other request). They are never messaged again.
- Never touches money. We send invoices and chase unpaid ones. We never take, move or
  refund payment, and never run a card.
- Never pretends to be the client. If asked, it says it is the company's assistant.

**Nobody pays before the agreement exists.** The service agreement is with an attorney and
Stripe is not finished. The `/start` flow stays reachable — there is no traffic yet — but no
payment may be collected until there is a countersigned agreement. The agreement must render
and be readable before any checkbox or payment step; a page that offers a tickbox over an
empty contract panel is the one failure here that actually costs something.

## Voice

Offer sections use "we". The owner's bio uses "I". Keep that split.

Write plainly, the way a knowledgeable person talks. Short sentences. Specific over
clever. No puffery, no "delve", no hollow triplets, no reflexive summaries, sparing
em dashes, varied sentence rhythm. Name things the way the reader would.

## Naming, keep consistent everywhere

| Thing | Name |
| --- | --- |
| The five automations | FIRST (new leads), TRACE (quote follow-up), CLOCK (scheduling), STARS (reviews), PAID (invoices) |
| Included with every plan | The daily brief, named WATCH on its card only; sentences keep "daily brief" |
| Client-facing agents | The GM, Intake, Schedule, Quotes, Billing, Aftercare, The Watch, The Fixer |
| Permission levels | Handle It, Tell Me, Ask Me, Never |
| Weekly client report | SITREP |
| Internal ops system | CICWO — **never shown to a client** |
| Tagline | Always on watch |

## Technical

- FAQ answers and the five automation names must be in the server HTML, not injected by
  script after load. They are the best sales copy on the site and Google currently sees none of it.
- Phone (877) 896-8784 is a `tel:` link in the header of every public page.
- The agreement must be readable at a plain URL before any checkbox or payment step.
- Must work at 375px wide with no horizontal scroll.

## Before you call anything done

Work through the checklist at the end of `docs/build-spec.md`.

## Since this package (November 6, 2026)

This repo is public. Keep margins, labour costs, legal matters, client details and anything personal out of it;
those live in the Shared Drive. The open-decisions and internal ops documents from the package are there too
(folder 03), not in this repo.

Decisions made after the package, which override `docs/build-spec.md` where they differ:

- **Automation names (Jerome, November 11):** Lead Catcher, Quote Chaser, Schedule Keeper, Review Builder and Invoice & Chase
  became FIRST, TRACE, CLOCK, STARS and PAID, each shown with a short label ("FIRST · new leads"). The daily brief card is
  named WATCH; everywhere else it stays "daily brief". One line reads them in order: FIRST answers, TRACE follows up,
  CLOCK keeps the day, STARS asks for the review, PAID gets the invoice out, WATCH tells you all of it every morning.
  **Not yet in the agreement:** `site/src/plans.js` and `site/src/contract.js` still use the old names until the attorney
  updates the agreement; change them together with the attorney's version. Trademark search pending.
- **Added November 11:** one page per automation (`/automations/first` and the rest), three calculators and a calculators
  page (`/calculators/`), "Not included" lists on the plan cards, two rows in the price comparison table, and a security
  band on Pricing and Services. Styles for all of it live in `site/public/extras.css` and calculator scripts in
  `site/public/calculators/*.js`, because the CSP allows no inline styles or scripts.

- Published plans (Jerome, November 10, replacing $450/$900/$75): Essential **$650** with **4 hours** a month,
  Business Support **$1,300** with **8 hours**, extra hours **$95 an hour** on both, only with written approval.
  12-month Retainers $7,020 and $14,040 (10% off). Custom Automation from $550 as specified. Set so both plans
  keep about 50% when every hour is used; the arithmetic is in the Shared Drive, not here.
- Founding client offer (November 10): the first three Business Support clients lock $1,300 a month for two
  years and get a free process map. No discount; monthly only.
- Retainer refund example: a $7,020 year ended after four months refunds **$4,420** (prepaid less the standard
  monthly price for each month started), which matches the agreement.
- The owner is named on the site with no photo for now.
- **The site is five main pages, not one long homepage** (Jerome, November 6): Home `/`, Services `/services`,
  Pricing `/pricing`, Industries `/for/` (with `/for/contractors` and `/for/law-firms`) and About `/about`, in that
  menu order on every page. This overrides the single-page section order in `docs/build-spec.md`; the sections
  and their copy are the same, just spread across pages. Each FAQ lives on the one page it answers, with that
  page's own FAQPage JSON-LD. The message form is on About only; every other page ends with Book a call.
  Run `python3 site/tools/check_site.py` before pushing (add `--fix` to update the CSP hashes for JSON-LD).

Current state, open bugs and next steps: `docs/handoff.md`.

## Where the history lives (read before deciding anything)

Earlier chats about Minutes Regained can't be read from a new session. Everything they settled was written down
in one of these places, so check them before redoing work or contradicting a past decision:

- **This repo:** `CLAUDE.md` (rules), `docs/handoff.md` (state and next steps), `docs/build-spec.md`, `mockups/`.
- **Shared Drive, 01 Start Here & Decisions:** the Decision and Cost Log (every decision with its date and reason)
  and the Master Register.
- **Shared Drive, 02 Business, Legal & Contracts:** the current business plan for attorney review, the attorney
  brief, and the filled-in client onboarding package. These carry the agreement version the attorney has; when
  the agreement changes, update all three, and tell Jerome the attorney needs the new version.
- **Shared Drive, 03 Operations & Automations:** the open decisions and internal ops documents (margins and labour
  cost live here, never in this repo).

When a session makes a decision, add it to the Decision and Cost Log and, if it changes the site, to the list above.
Nothing is ever sent to the attorney, clients or prospects by a session; Jerome sends.
