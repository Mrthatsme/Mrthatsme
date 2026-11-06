> Site package as received on November 6, 2026. In this repo, `CLAUDE.md` is at the root and the build spec and mockups are in `docs/` and `mockups/`.
> Two internal documents from the package (open decisions, internal ops) are kept in the Shared Drive, folder 03, because this repo is public.
> Decisions made after the package are in `docs/handoff.md`.

# Minutes Regained — site and ops package

Everything needed to rebuild the site and stand up the internal ops layer.

## Start here

1. `CLAUDE.md` — standing rules. Claude Code reads this automatically. It holds the voice,
   the hard rules about inventing proof, the never-list, naming, and the fact that the buy
   path is deliberately closed right now.
2. `docs/build-spec.md` — what the site should say and in what order, with paste-ready copy
   and an acceptance checklist.
3. Open decisions (Shared Drive, folder 03 — not in this public repo) — six things that need a decision, with the arithmetic. Three of
   them affect pricing on the live site.
4. Internal ops spec (Shared Drive, folder 03 — not in this public repo) — the internal agents that watch margin, hours, systems and
   SLA. Not client-facing.

## Mockups

Reference implementations. Open them in a browser. They are not the site — they show what
the sections should look like and read like, and the copy in them is current.

| File | What it shows |
| --- | --- |
| `mockups/homepage.html` | The full homepage in the new section order. The pricing calculator works. |
| `mockups/pricing-section.html` | The pricing section on its own, with the calculator. |
| `mockups/demo-back-office.html` | The product demo: a whole back office running. Five triggers. |
| `mockups/demo-admin-desk.html` | The VA side: inbox, calendar, handed-over tasks, hours split. |

## Order of work

**Today, before anything else:** fix the agreement on `/start`. The panel currently sits at
"Loading the agreement…" next to its own warning not to continue. Publish the agreement at a
plain readable URL and make the fallback useful. The buy path itself can stay open — there is
no traffic yet — but nobody pays before there is a countersigned agreement to pay against.

**Then, in order:**

1. Homepage section order and hero copy
2. The "bring us the thing" section with its three worked examples
3. The admin section and the tools row
4. Bio, the one-person question, and the proof scaffolding
5. Phone in the header, demo on the homepage, FAQ rendered server-side
6. Pricing — **hold until the open decisions are settled**, because the numbers will change

**Not yet:** Clutch Verified, collecting an actual payment, anything that implies a client
exists.

## Things that are true and should not be re-litigated

- There are no clients. Nothing on the site may imply otherwise.
- The agreement is not back from the attorney, so no payment gets collected yet.
- There is no business bank account, no insurance, and Stripe is not finished.
- Operations+ is retired.
- The automation is called Invoice & Chase, not Invoice Reminder.
- No location line in the bio, and nothing beyond the bio copy anywhere.
