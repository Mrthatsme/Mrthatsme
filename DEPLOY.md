# Minutes Regained: new site + client portal

Three folders:

| Folder | What it is |
|---|---|
| `site/` | The **new website**, ready to deploy. Six redesigned pages (home, how it works, services, pricing, book, about) plus every other page from the current site, unchanged. |
| `backup/current-site/` | A **full copy of the live site as of Nov 16, 2026**. Deploy this folder to roll back. |
| `portal/` | The **client portal / CRM**: its own Cloudflare Worker and D1 database, served at `/portal` and `/api/portal/*`. |

`site-src/v2.js` is the site script source. The pages and `v2.css` come from the design canvas via the converter (see "Regenerating" below).

---

## 1. New website

The new pages are plain static files and follow the live site's security policy (no inline styles or scripts). The Book form posts to the existing `/api/leads` endpoint, so new leads land in the same place they do today.

Deploy the `site/` folder the same way the current site's static files are deployed. The site's source isn't in this repo, so match whichever applies:

- **Workers static assets:** copy `site/*` into that Worker's assets directory and run `npx wrangler deploy` from that project.
- **Cloudflare Pages:** `npx wrangler pages deploy site --project-name <your-pages-project>`

**Roll back:** deploy `backup/current-site/` the same way.

New URLs: `/how-it-works` and `/book`. Existing URLs keep working: `/services`, `/pricing`, `/about`, `/agreement`, `/privacy`, `/client`, `/access`, `/demo`, `/for/*`, `/automations/*` and `/calculators/*`. Pages outside the redesign keep the old look for now.

## 2. Client portal

One-time setup, run from the `portal/` folder:

```bash
cd portal
npm install
npx wrangler login                       # or set CLOUDFLARE_API_TOKEN
npx wrangler d1 create mr-portal         # copy the database_id it prints into wrangler.jsonc
npm run db:remote                        # creates the tables
openssl rand -hex 24                     # makes a setup key; copy it
npx wrangler secret put SETUP_KEY        # paste the key
npm run deploy                           # goes live on /portal and /api/portal/*
```

Create your admin login (this works only once, while no admin exists):

```bash
curl -X POST https://minutesregained.com/api/portal/bootstrap \
  -H "content-type: application/json" -H "x-setup-key: <your setup key>" \
  -d '{"email":"support@minutesregained.com","name":"Jerome"}'
```

Open the `setup_url` it returns and pick a password. You'll land in the admin console at `/portal/admin`.

The routes in `wrangler.jsonc` cover only `/portal*` and `/api/portal/*`, so the main site's Worker (leads, contracts, Stripe) keeps handling everything else. To remove the portal, delete the `mr-portal` Worker in the Cloudflare dashboard.

### Day to day
- **New prospect or client:** Admin → "+ New account" gives you a one-time setup link. Copy it, or use "Email it" to open a drafted email.
- **Forgot password:** open the account, then "Reset link".
- **Morning report, approval, document, invoice:** open the account, scroll to "What the client sees", then "+ Add".
- **Client requests:** they show up on the account. Set the status, log hours (added to their hands-on hours), and write a reply they can see.
- **Stage:** change it in "Account details". The client's "Getting started" tracker updates right away.

### Security
Passwords are hashed with PBKDF2-SHA256 (100k rounds). Sessions are HttpOnly, Secure, SameSite=Lax cookies; the database stores only a hash of each one. Setup links work once, expire after 7 days, and are hashed in the database. Five wrong passwords lock the login for 15 minutes. Cross-site POSTs are refused. Clients can only ever see their own account. Internal notes are admin-only.

### Testing
`npm run dev` starts it locally. Then, against a fresh local database:
```bash
npm run db:local
BASE=http://localhost:8787 SETUP_KEY=<key in .dev.vars> node test/smoke.mjs
```
That's 30 end-to-end checks: admin and client flows, permissions, lockout, CSRF and phone layout.

## Regenerating the site from the design canvas
The converter lives outside the repo. Ask Claude to "regenerate the site from the homepage refresh canvas" after design changes.
