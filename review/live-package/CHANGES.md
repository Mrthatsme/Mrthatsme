# Live-site package: approved changes only

Approved by Jerome on 2026-11-11. Everything in `site/` is production-ready: no draft banners, no review notes.

## What's in it

| File (in `site/`) | URL | What changed |
|---|---|---|
| `index.html` | `/` | Automation names → **FIRST · new leads, TRACE · quote follow-up, CLOCK · scheduling, STARS · reviews, PAID · invoices**, and "WATCH, your daily brief, with every plan". Each name links to its new page. One calculator line under "Compare the plans". Page description updated with the new names. |
| `services.html` | `/services` | Same names on the five cards and **WATCH** · daily brief on the brief card. One "See how it works →" link per card. Security band after "We work in what you already run." FAQ answers and page description use the new names. |
| `pricing.html` | `/pricing` | "Not included" list on each plan card. Two new rows in "What the price pays for" (do it yourself; one-off automation builds). "More calculators" links under your calculator. Security band before the Questions section. The sample monthly report uses the new names. |
| `automations/first.html` … `paid.html` | `/automations/first` (and `trace`, `clock`, `stars`, `paid`) | **New.** One page per automation, built in your live header, footer and booking section. |
| `calculators/index.html` + 3 | `/calculators/`, `/calculators/slow-replies`, `/calculators/cold-quotes`, `/calculators/late-invoices` | **New.** Three calculators plus a page listing them. Nothing a visitor types leaves their browser. |
| `mrx.css` | `/mrx.css` | **New.** Styles for the new pages only. It reuses your color tokens from `landing.css`, and every rule is scoped so it can't change existing pages. |

**Unchanged:** your wording everywhere else, `landing.css`, `site.js`, all other pages. Old links like `/services#lead-catcher` still work.

**Not included (not approved):** light/dark switch, proof log, Process Map offer, `llms.txt`.

## Before you publish

1. **Trademark check:** search FIRST, TRACE, CLOCK, STARS, PAID and WATCH at USPTO.gov.
2. **Other live pages that still use the old names** (checked 2026-11-11):
   - `/for/contractors`: 5 mentions. `/for/law-firms`: 1 mention. Tell me and I'll update both the same way.
   - `/agreement`: 6 mentions. **This is your client agreement, which is with your attorney.** Have the attorney make the name change, or add one line mapping the new names to the old ones, so the contract and the website use the same terms.
   - `/demo`, `/demo-desk`, `/about`: none.
3. **Sitemap:** add the 9 new URLs to `sitemap.xml` if you have one.

## Publishing

- **Through GitHub (preferred):** connect the site's repository to this session and I'll open a pull request with these files in the right places, matching the repo's folder layout.
- **By hand on Cloudflare Pages:** copy `site/` over your project files (same paths) and deploy. These files assume clean URLs (`/pricing` served from `pricing.html`), which is how your site works today. If your project uses folders instead (`pricing/index.html`), I'll adjust the paths.

## How this was checked

- Every new and updated page was loaded with your real `landing.css` and `site.js`: no script errors and no missing files.
- No horizontal scrolling at phone width (390px).
- Calculator math tested.
- Each updated page was diffed against the live version: only the changes listed above.
