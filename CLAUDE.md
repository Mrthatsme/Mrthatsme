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
- **Going live (November 12):** Jasmine Brown has not returned contract recommendations (last message November 3);
  a proposed agreement v2026-11-12.1 with liability, indemnity, Florida law and venue, AI disclosure and e-signature
  clauses is in the Shared Drive (02) as a draft for attorney review, not in use. Stripe here is a test sandbox; the live
  account is not activated and has no bank account. The step-by-step order to go live is at the top of
  `site/SETUP-PAYMENTS.md`. Do not open sign-ups before counsel approves the agreement.
- **Admin gate (November 11):** every `/api/admin` request goes through `adminGate` in `site/src/protect.js`: 10 wrong
  passwords from one IP in 15 minutes locks that IP out for the rest of the window, the password is compared in constant
  time, and a request that changes something is refused if another site started it (Origin / Sec-Fetch-Site). Error
  detail is returned only after the gate has passed; everyone else gets `internal_error` with no message.
  `/api/agree` and `/api/checkout` are rate-limited per IP (added November 12).
- **Process-map tool (November 11):** `node site/tools/process_map.mjs <folder> --business "Name"` reads a client's
  exported files on Jerome's own computer and drafts where work slips, with Claude Fable 5.2 (one retry on Opus 5.5 if
  it declines). It shows the token count and cost and sends nothing without `--go`; leaves out any file that mentions a
  `--never` sender; marks any quote not found in the files UNVERIFIED; and works out dollars in code. Its output is a
  draft with estimates, never a client result. Client files and drafts never go in this repo (`process-map-out/` is
  git-ignored). Anthropic keeps Fable requests for 30 days: don't run it on files promised no retention.
- **The weekly SITREP (Jerome, November 11):** `site/src/sitrep.js` emails each client's owner on Monday at 7 AM their
  time, covering the Monday-to-Sunday week before, and sends Jerome a copy. It goes out on its own (Jerome's decision);
  a week with nothing to report is skipped. Code gathers the facts; Claude Sonnet 5.5 writes one short paragraph from
  counts and open questions only (never a customer's name or an email subject), and code drops the paragraph if it
  contains any number that is not on the fact sheet, a percentage, a dollar amount or a spelled-out quantity. "Time you
  got back" is counts times minutes per task: the standard `DEFAULT_MINUTES` (5 a drafted reply, 5 a form request, 10 a
  voice note; the 10 is our own figure, not a published one) until a client's `profile.sitrepMinutes` is agreed on the
  assessment call, and the report says which was used. Preview or resend: POST `/api/admin/sitrep` `{agentId, preview}`
  or `{agentId, force}`. A failed send is recorded and reported to Jerome, and does not retry on its own.
- **Second look and AI cost per client (Jerome, November 11):** inbox drafts stay on Claude Haiku 5.5. A plain rule in
  `site/src/clientagent.js` (`stepUpReason`), never the AI, sends a few drafts to Claude Sonnet 5.5 for a second pass:
  threads over 2,500 characters, drafts with 2 or more [GAP]s, or a repeat customer's question. Never urgent, emergency,
  hand-off or Never email. Off per client until "Second look on Sonnet" is ticked on the admin levels card; at most 5
  attempts a day per client (its own counter, `<agent id>#stepup` in `client_agent_usage`); any failure or decline keeps Haiku's draft, and Sonnet may only improve a draft or hand it off. The
  Sonnet call uses structured output because Sonnet 5.5 rejects the forced tool choice the Haiku call uses. Every model
  call logs tokens to `client_agent_tokens` (per client, day and model); Jerome's brief shows each client's AI cost this
  month at the list prices in `PRICES`, which must be updated when Anthropic's prices change.
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
