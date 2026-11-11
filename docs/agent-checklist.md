# Agent checklist: what each client's back office needs, and where we stand

Started November 10, 2026 from a general back-office diagram Jerome liked. It is used here as a checklist of
capabilities, in our own names; it is not our design and is not copied onto the site. Update the status column
whenever something is built or decided. Anything that would message a customer still has to pass the never-list
in CLAUDE.md.

Status: **Built** (works today), **Partly**, **Not yet**, **Not offered** (deliberately out of scope).

## The shape

| Layer | Ours | Status |
| --- | --- | --- |
| Owner reviews and approves | Every reply is a draft the owner sends; permission levels Handle It / Tell Me / Ask Me / Never (`site/src/levels.js`) | Built November 11: every email gets a category and follows the client's level; the never-list is enforced as ceilings (price and cancel/change never above Ask Me; complaints, legal, payment always Never); a Never list of senders is never sent to the AI; set per client on the dashboard. Handle It / Tell Me on a reply still drafts until approved replies exist (attorney). **Not yet:** the client's own "pause everything with one switch" promised on Services; only Jerome can pause today |
| Coordinator | **The GM** (`site/src/gm.js`) | Partly: brief twice a day, client rules and approved answers, answers other agents' questions, learns from Jerome, hours and builds, today's schedule (read-only, internal). Not yet: routing work between agents, task board, a daily summary the owner OKs |
| Internal build team | Jerome (and CICWO, never shown to a client) | Built: setup, connections, repairs |

## Client-facing agents

| Capability | Our agent / automation | Status | Next step |
| --- | --- | --- | --- |
| Inbox: sort, draft, flag | **Intake** | Built for Gmail (polls every 10 minutes, drafts, labels MR/Draft-Ready, MR/Needs-You, MR/Urgent). Outlook code exists, Microsoft keys not set | Set the Microsoft keys when a client needs Outlook |
| Documents: file in the right place | Intake | Not yet (no Drive access) | Needs Google Drive permission, so Google verification first |
| New leads answered fast | **Lead Catcher** / Intake | Partly: request form, drafted reply, fixed acknowledgement, emergency routing | Website chat widget per client |
| Quote follow-up | **Quote Chaser** / Quotes | Not yet | One reusable Zapier recipe, tested on QA Test Co, demo-able on calls |
| Scheduling, reminders, no-shows | **Schedule Keeper** / Schedule | Not yet | Calendar permission (Google verification), or the client's own scheduling app via Zapier |
| Invoices sent and chased (never takes money) | **Invoice & Chase** / Billing | Not yet | Built in the client's own invoicing tool at onboarding |
| Reviews after a job | **Review Builder** / Aftercare | Not yet | Built per client at onboarding |
| Customer accounts in a CRM | (none yet) | Not yet | Connect through the client's CRM or field-service app; confirm on the assessment call |
| Watching that everything runs | **The Watch** (`site/src/gmwatch.js`) | Built November 11: every 10 minutes, emails Jerome when a problem starts and when it clears (inbox disconnected or not checked, agent quiet, our script stopped, inquiries stuck, hours nearing the restructure trigger). `/api/health` for an outside uptime monitor | Jerome sets up a free uptime monitor on /api/health |
| Fixing what breaks | **The Fixer** | Jerome, by hand | Stays human for now |
| The Daily Brief to each client | The GM / The Daily Brief (`site/src/clientbrief.js`) | Built November 10: every morning, today's calendar, overlaps, what's waiting on them, what came in, hours used. Skipped on an empty day | Turn it into a short yes/no list the owner OKs |
| Marketing posts and graphics | none | Not offered | Out of scope; revisit only as a deliberate decision |
| Campaigns and promotions | none | Not offered | Conflicts with the never-list: messages people who didn't contact the business first |

## Connected tools

| Tool | Status |
| --- | --- |
| Email | Built (Gmail). Outlook ready but not switched on |
| Calendar | Built in code, read-only (Google `calendar.events.readonly`, Microsoft `Calendars.Read`). Jerome must add the scope to the Google consent screen; it becomes part of Google's verification. Owners can untick it and still connect email |
| Drive / Docs | Not yet (same) |
| CRM / field-service app | Not yet (Zapier per client; Jobber, ServiceTitan, Housecall Pro, Workiz, FieldPulse verified in Zapier) |
| Task board | Not yet |
| Design tools | Not offered |

## Suggested order

1. ~~Calendar permission~~ read-only built November 10; next is writing events behind the owner's OK (Schedule Keeper).
2. A daily summary the owner OKs.
3. Quote Chaser as a reusable recipe, tested on QA Test Co.
4. ~~The GM's watch with instant alerts~~ built November 11.
