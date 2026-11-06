# Site build spec

Consolidated and current as of 2026-11-06. This supersedes earlier drafts.

Sections are named by their visible heading, not by file. Copy marked as copy is
paste-ready — use it verbatim rather than paraphrasing.

---

## Homepage section order

| # | Section |
| --- | --- |
| 1 | Hero |
| 2 | Bring us the thing that keeps falling through (+ three worked examples) |
| 3 | The demo |
| 4 | You decide what it's allowed to do (permission dial + never-list, merged) |
| 5 | The five automations |
| 6 | And a person for everything that needs judgement |
| 7 | Who this is for |
| 8 | Your tools |
| 9 | Pricing (calculator, then cards, then the hold notice) |
| 10 | How it starts |
| 11 | Who runs this (+ the one-person question) |
| 12 | Questions |
| 13 | Final CTA + contact form |

That order answers a buyer's questions in the order they ask them: what is this, what do I
bring you, what does it look like, what is it allowed to do, how does it get better, what
else do you do, is this for me, will it work with my stuff, what does it cost, how do we
start, who are you.

`mockups/homepage.html` is the reference implementation of all of it.

---

## 1. Hero

**Eyebrow:** Virtual assistant support and automation for small businesses

**Headline:** Every lead answered. *Even at dinner.*

**Subhead:** We map how work actually moves through your business, run the gaps by hand
until we both know the pattern, then turn what repeats into automations your team approves.
Your people do the work. We handle the office work.

**Under it:** For the first two weeks nothing sends. Everything is drafted and held so you
can read exactly what it would have said to your customers, before a single message goes out.

**Buttons:** Book a free assessment · See pricing

**Proof line:** Taking our first three clients. No reviews yet, and we're not going to
borrow anyone else's.

---

## 2. Bring us the thing that keeps falling through

Lead with the problem in their words, not with the technology.

> You don't need to know whether it's a people problem or a software problem. Tell us
> what's slipping. The quotes nobody circles back on. The calls that come in while
> everyone's on a job. The invoices sitting out there unpaid. The inbox nobody has been
> to the bottom of since spring.
>
> We'll tell you what it would take to close that gap, and then we close it. Sometimes
> that's a person doing the work. Usually it ends up being an automation doing it every
> day, built in your own accounts, with wording you approved.

Then three worked examples, each in the same shape — the ask, week one, by month two.
Inbox cleanup, quote follow-up, no-shows. Full copy in the mockup.

Close the section with the model sentence:

> **That's the model.** A person does it first, so you can watch it done your way before
> anything runs on its own. Then the parts that repeat become automations, and the hours
> go back to the things that actually need a human.

---

## 3. The demo

Move the Command Center demo onto the homepage as a compact strip. Keep `/demo` as its own
page and link to it with "Open the full demo." Keep the sample-data label exactly as written.

`mockups/demo-back-office.html` — the whole back office running, with five triggers.
`mockups/demo-admin-desk.html` — the VA side: inbox, calendar, handed-over tasks, hours split.

Link the two demos to each other.

---

## 4. You decide what it's allowed to do

One block, two halves. The four permission levels (Handle It, Tell Me, Ask Me, Never) with
their one-line descriptions and examples, then the never-list underneath.

Delete the old standalone "You write the rules. It follows them." section — its content
lives here now.

This is the only thing on the site no competitor can copy without rebuilding their product.
It belongs in the top third of the page.

---

## 5. The five automations

**Heading:** Five things, named. Here's what the help turns into.

Lead Catcher · Quote Chaser · Schedule Keeper · Review Builder · Invoice & Chase, plus
The Daily Brief as an included extra. Full copy in the mockup.

Invoice & Chase sends the invoice when the job closes and follows up the unpaid ones.
It never takes payment. Do not weaken that distinction anywhere.

---

## 6. And a person for everything that needs judgement

Two columns: *kept current every week* (inbox triage, calendar, meetings, documents, CRM
hygiene, receipts, supplier correspondence, invoices raised and chased, voice notes) and
*hand us one thing* (reschedule a week of jobs, clean a contact list, clear a backlog,
build a spreadsheet, chase a supplier, set up a new hire).

Then how hours are counted, then the line about the two sides trading places over time.

---

## 7–8. Who this is for, and your tools

Audience: ten to fifty people · growing faster than the process · trades and field services ·
several crews or locations.

Tools row: email and calendar, jobs and dispatch, invoicing and books, leads and forms.
Close with: *most business software connects, and we check yours during the free assessment
rather than guessing. If yours doesn't, you'll hear it on that call instead of after you've
paid us.*

---

## 9. Pricing

Calculator first — three inputs (hours a week, people doing the work, cost per hour), it
recommends the plan. Defaults 12 / 3 / $45. Then three cards, ascending.

### Current numbers

| | Essential | Business Support | Custom Automation |
| --- | --- | --- | --- |
| Monthly | $450 | $900 | From $550 |
| After build paid off | — | — | Drops to $250 |
| Minimum term | 30 days' notice | 30 days' notice | 12 months, then monthly |
| Core automations | 3 of 5 | All 5, plus 1 custom | Built to the operation |
| Hands-on admin | 5 hrs/mo | 12 hrs/mo | None |
| Software allowance | $50/mo | $100/mo | Theirs |
| Inboxes | 1 | 2 | None needed |
| Review call | — | 30 min monthly | 60 min quarterly |

Custom Automation scopes: One gap $550/mo → $250 · One side of the business $1,150 → $450 ·
Whole back office $2,100 → $750. Or pay the build upfront ($2,500 / $6,000 / $12,000) and
start at the lower rate.

**Operations+ is retired.** Do not reinstate it.

### Open — see the open-decisions document (Shared Drive, folder 03; not in this public repo)

The hours and overage numbers above do not clear a 50% margin and are being revised.
Don't hard-code them anywhere they'd be painful to change.

### The hold notice, directly under the cards

Optional while there is no traffic, and worth adding the day the Google profile goes live or
the first prospect is sent to the site.

> **Taking our first three clients.**
>
> Our service agreement is with our attorney right now, and we're not signing anyone until
> it's back and right. If something in your week is falling through, book the assessment
> anyway. You'll leave with a written plan either way, and you'll be first in line when the
> paperwork clears.

### Fine print

> There's no setup fee. Your first month is non-refundable once we start building, because
> that's the month the build happens. Leave a retainer early and unused months are refunded
> at the full monthly rate, so a $4,860 year ended after four months refunds $2,860. Voice
> notes over your allowance are $10 for each extra 100.

---

## 10–11. How it starts, and who runs this

Four steps: free assessment (30 min, you keep the written plan), approve your words (under
an hour), read-only trial (2 weeks, part of the first month), go live.

Bio: named, photographed, first person. 20 years and 6 months in the Navy as an Operations
Specialist, Lean Six Sigma Master Black Belt. **No location line, and nothing beyond what this bio
says.** Four accountability bullets plus the NDA line.

Then the one-person question — *"You're one guy. What happens if you're not around?"* — with
the four answers: runs in your accounts not mine, everything documented with build
recordings, you can cut access in thirty seconds, what stops is new work not the running of
what's there.

A forty-person company asks this in the first meeting. Answer it before they have to.

---

## 12–13. Questions, and the close

FAQ as written in the mockup, **rendered server-side**. Final CTA offers the assessment and
the phone number.

Footer carries three empty badge slots labelled "empty until earned": Google rating, Zapier
Solution Partner, Clutch profile.

---

## Proof scaffolding

Build the slots now, empty, so the first good thing a client says can go live the same day.

- A review strip under the hero, currently holding the honest line.
- A testimonial block above the final CTA, hidden until there's one to fill. Each needs the
  quote, first name and last initial, business name, town. Under it, permanently:
  *These are self-reported results, shared voluntarily by clients.*
- A results line under each automation card for one measured number with the client's town.

**Do not build** a logo wall, a client counter or a "trusted by" strip.

---

## Before you call it done

- [ ] The agreement renders on `/start` before the checkbox, and is also readable at a plain
      URL with no script and no login.
- [ ] No payment can complete until there is a countersigned agreement.
- [ ] The phone number is tappable in the header on a phone, on every public page.
- [ ] View source: the five automation names and the FAQ answers are in the HTML.
- [ ] Search the site for "$1,500" and "Operations+" — nothing references the retired plan.
- [ ] Search for "Invoice Reminder" — all renamed to Invoice & Chase.
- [ ] No location line in the bio. Nothing beyond the bio copy anywhere.
- [ ] "No setup fee" and the first-month language don't contradict each other.
- [ ] The founding offer appears once, on Business Support only.
- [ ] Every plan button says Book a call and lands on the calendar.
- [ ] Both `/client` buttons work or say where the link comes from.
- [ ] Every sample screen carries its sample-data label.
- [ ] 375px wide: no horizontal scroll, the demo still reads.
