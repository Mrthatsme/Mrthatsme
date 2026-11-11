# Minutes Regained: review package (DRAFT, not live)

Everything in this folder is a **proposal for review**. Nothing has been changed on minutesregained.com. Each item waits for Jerome's approval.

**Wording:** Jerome keeps the live site's wording. The rewrite drafts were removed, and every mockup here uses the live site's own phrases. 12-hour time throughout.

## Ideas taken from the other site's *structure* (their wording is not used)

| # | What they do | Our draft | Files | Status |
|---|---|---|---|---|
| 1 | Light/dark switch in the header | Auto (follows the visitor's device) · Light · Dark. Remembers the choice. The live stylesheet already supports it; only the button is missing. | In every mockup header · `screenshots/*-desktop-dark.png` | Drafted |
| 2 | One page per job, each with what it does and what it doesn't | Five automation **outcome** pages: result, sample message, Daily Brief entry, hard limits. **No how-to.** | `mockups/automations/*.html` | Drafted |
| 3 | Free cost calculators on their own pages | Three calculators (slow replies, forgotten quotes, late invoices) plus a hub page. They put a dollar figure on the problem and teach nothing. | `mockups/tools/*.html` | **New. Drafted** |
| 4 | "Included / Not included" on every offer | Added to all three plan cards. Prices and details unchanged. | `mockups/02-pricing.html` (top) | Drafted |
| 5 | A paid first step, credited toward the build (their $249 call) | **Optional.** A paid Process Map, credited toward month one. Not a price change to your plans. Drop it if you don't want it. | `mockups/03-process-map.html` | Drafted, **your call** |
| 6 | "Tested" receipts, dated | A proof log page. Format only; no invented results. | `mockups/05-proof-log.html` | Drafted, needs real tests |
| 7 | Site files AI assistants can read (`llms.txt`, data feeds) | `llms.txt` describing your services and limits | `llms.txt` | Drafted |

## Ideas that came from comparing the two sites (not copied from theirs)

| What | Why | Files |
|---|---|---|
| Cost comparison table (do it yourself / one-off builds / hire an admin / Minutes Regained) | Your plans cost less per automation than buying one-off builds plus upkeep. The table shows that without naming anyone. | `mockups/02-pricing.html` (middle) |
| Security band | They exclude "security work of any kind." Your background is cybersecurity. | `mockups/02-pricing.html` (bottom) |

## Not doing, by decision
- Free step-by-step how-to pages (could teach a prospect to do it themselves).
- Low-price $19 kits, Grok-specific content, evening-only calls.
- Rewriting the live site's wording.

## Side by side with the real page
`compare/index.html` shows your **actual live pages** (exact copies) next to the same pages with only the additions dropped in, each marked with an orange **NEW** box. Use the Home / Pricing / Services tabs at the top.
- Home images: `screenshots/compare-home-*.png` (header + hero, five automations, pricing line, full page). Kept deliberately light: busy owner-operators won't scroll or click through a lot.
- Pricing images: `screenshots/compare-pricing-*.png` (header, calculator, plan cards, price table, security band)
- Services images: `screenshots/compare-services-*.png` (header, automation cards with links, tools + security band, demo + proof log link)

**To view:** open any `.html` file in `mockups/` in a browser. The dashed orange boxes are review notes, not page content.
