# Payments / CRM / contracts — setup checklist

Code is written and ready to deploy. These are the remaining steps that need
your Stripe account and an updated Cloudflare token — I can't do these for
you without them.

## 1. Cloudflare: D1 database permission
Add **"D1" → "Edit"** permission to the API token (My Profile → API Tokens →
edit the token you already created). Paste the token back once updated.

## 2. Stripe: create the four recurring Prices
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
