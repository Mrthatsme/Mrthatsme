# Payments / CRM / contracts — setup checklist

## Going live: the order (written November 12, 2026)

Status today: sign-ups are closed (`SIGNUPS_OPEN` unset), Stripe is test mode only, and the
agreement has not had legal review. Nothing below is done yet. Do the steps in order.

1. **Fictitious name.** Register "Minutes Regained" for Provident Watch LLC with the Florida
   Division of Corporations (sunbiz.org), as section 865.09, Florida Statutes, requires before
   doing business under it. Confirm with counsel how the agreement names the parties meanwhile.
2. **Attorney sign-off.** Counsel reviews "DRAFT FOR ATTORNEY REVIEW — Service Agreement
   v2026-11-12.1" (Shared Drive, 02 Business, Legal & Contracts) and the 12 questions in the
   attorney brief. Confirm counsel is a member of The Florida Bar (floridabar.org member search).
3. **Put the approved text in the code.** Replace the wording in `src/contract.js`, bump
   `CONTRACT_VERSION`, and rename `CORE_AUTOMATIONS` in `src/plans.js` to FIRST, TRACE, CLOCK,
   STARS and PAID at the same time, so the agreement matches the site. Run all `site/tools/test_*.mjs`.
4. **Business bank account, then Stripe activation.** In the Stripe dashboard, activate the live
   account: business details, EIN, identity verification and a payout bank account. Stripe asks
   for the bank account during activation.
5. **Live Prices.** With the live secret key:
   `STRIPE_KEY=sk_live_... node site/tools/stripe_live_prices.mjs` (shows what it would do), then
   the same with `--create`. It creates the four Prices with the lookup keys checkout uses and
   never duplicates one. (Running it from a Claude session needs `NODE_USE_ENV_PROXY=1`.)
6. **Live webhook.** Stripe dashboard (live mode) > Developers > Webhooks: endpoint
   `https://minutesregained.com/api/stripe/webhook`, events `checkout.session.completed`,
   `invoice.paid`, `invoice.payment_failed`. Copy the signing secret.
7. **Cloudflare secrets** (from `site/`): `npx wrangler secret put STRIPE_SECRET_KEY` (live key)
   and `npx wrangler secret put STRIPE_WEBHOOK_SECRET` (live signing secret).
8. **Open sign-ups.** Set `SIGNUPS_OPEN = "true"` in the Worker's variables.
9. **One real test.** Sign up with your own card on the cheapest plan, confirm the signed
   agreement is stored and emailed, the subscription appears in Stripe, then cancel and refund it.

Already done: online signing (typed name, time, IP, version and SHA-256 of the text), checkout
that refuses a Price whose amount doesn't match the signed agreement, and per-IP limits on
`/api/agree` and `/api/checkout` (added November 12).

Code is written and ready to deploy. These are the remaining steps that need
your Stripe account and an updated Cloudflare token — I can't do these for
you without them.

## 1. Cloudflare: D1 database permission
Add **"D1" → "Edit"** permission to the API token (My Profile → API Tokens →
edit the token you already created). Paste the token back once updated.

## 2. Stripe: the recurring Prices (updated November 10, 2026)

Created in **test mode** on November 10 on product `prod_VQPwRafurf0MNS`. Checkout
finds each Price by its **lookup key** and refuses to start unless Stripe's amount
and interval match the signed agreement exactly, so a price change needs no
Cloudflare secret: create the new Price with the same lookup key and
"transfer lookup key" on.

| Lookup key | Amount | Test-mode Price |
|---|---|---|
| monthly_essential | $650 / month | price_1UaLg0LM63aam91BjtBDh8DL |
| retainer_yearly_essential | $7,020 / year | price_1UaLg1LM63aam91BURrlgccv |
| monthly_business_support | $1,300 / month (also the Founding Client rate lock) | price_1UaLg1LM63aam91BjbLiQJJ8 |
| retainer_yearly_business_support | $14,040 / year | price_1UaLg1LM63aam91BhpKxkHCV |

The old STRIPE_PRICE_* secrets are only a fallback and must pass the same amount
check, so stale ones can't charge an old price. The ten old Prices ($450, $900,
$450 founding, Operations+, old yearly) are still active in test mode; archive them
in the Stripe dashboard. When switching to live mode, create the same four Prices
with the same lookup keys in live mode.
Extra hours ($95) and voice-note overages are added as invoice items by the
code, so they need no Price. The original setup notes follow.

## 2a. (original) Stripe: create the four recurring Prices
In the Stripe Dashboard (**test mode** to start — switch to live only when
ready to actually charge cards), create one Product ("Minutes Regained —
AI Operations") with four recurring monthly Prices:

| Price nickname      | Amount   | Notes                                              |
|----------------------|----------|-----------------------------------------------------|
| Essential            | $450/mo  |                                                       |
| Business Support     | $900/mo  |                                                       |
| Operations+          | $1,500/mo|                                                       |
| Founding Offer       | $450/mo  | Same amount as Essential, but tied to the Business Support plan for the first 3 clients. Simplest setup: a plain $450/mo recurring price; rolling it to the standard $900/mo rate after 90 days takes a Stripe subscription schedule, which we can wire up once the basic flow is live — or handle the upgrade as a manual one-time task in the first 3 cases, since it's only 3 clients. |

Give me the four Price IDs (`price_...`), or give me a **restricted API key**
with write access to Products/Prices/Checkout Sessions and I'll create them
via the API myself.

## 3. Stripe: get the secret key + webhook secret
- **Secret key** (`sk_test_...` to start): Developers → API keys.
- **Webhook signing secret**: Developers → Webhooks → add an endpoint at
  `https://minutesregained.com/api/stripe/webhook`, subscribe to
  `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed` →
  copy the signing secret (`whsec_...`).

I'd rather you set these as Cloudflare secrets yourself (they never touch
chat that way) by running, from `va-deploy/`:

```
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRICE_ESSENTIAL
npx wrangler secret put STRIPE_PRICE_BUSINESS_SUPPORT
npx wrangler secret put STRIPE_PRICE_OPERATIONS_PLUS
npx wrangler secret put STRIPE_PRICE_FOUNDING_OFFER
npx wrangler secret put ADMIN_PASSWORD
```

(each prompts for the value; nothing is echoed or logged). If you'd rather
just paste them here and have me run it, that's fine too — your call.

`ADMIN_PASSWORD` is the password for the internal CRM view at
`/api/admin/dashboard` (username `admin`). Pick anything; it's only shared
between us.

## 4. Apply the D1 migration
Once the database exists and is bound in `wrangler.toml`:

```
npx wrangler d1 execute minutesregained-crm --remote --file=migrations/0001_init.sql
```

## 5. Legal review
The contract text in `src/contract.js` is a plain-language service agreement
I drafted from the terms already published in your site's FAQ (month-to-month,
30-day notice, no financial access, control levels, data handling). **I'm not
a lawyer and this hasn't had legal review** — please have an attorney look at
it before relying on it for real signed agreements, especially the liability
and data-handling language.

## 6. Go live
Once 1-5 are done, I'll redeploy via `wrangler deploy` and do a full real-browser
test of the checkout flow in Stripe test mode before anything goes live for
real money.
