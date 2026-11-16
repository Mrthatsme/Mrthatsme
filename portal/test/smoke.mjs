// End-to-end smoke test for the client portal.
// Run against local dev:  BASE=http://localhost:8799 SETUP_KEY=local-test-setup-key-123456 node test/smoke.mjs
// Needs a fresh database (it bootstraps the first admin).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.NODE_PATH + '/playwright')); }

const BASE = process.env.BASE || 'http://localhost:8799';
const SHOTS = process.env.SHOTS || null;
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
const api = async (path, opts = {}) => {
  const r = await fetch(BASE + '/api/portal' + path, { method: opts.method || 'GET', headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const browser = await chromium.launch();
const cspErrors = [];
const newCtx = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) cspErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => cspErrors.push('JS: ' + e.message));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Please use the Tuesday slot' : undefined));
  return { ctx, page };
};

// 1. bootstrap admin
const boot = await api('/bootstrap', { method: 'POST', headers: { 'x-setup-key': process.env.SETUP_KEY }, body: { email: 'admin@example.com', name: 'Jerome' } });
check('bootstrap first admin', boot.status === 200 && /setup\?token=/.test(boot.body.setup_url || ''), String(boot.status));
check('bootstrap refuses second time', (await api('/bootstrap', { method: 'POST', headers: { 'x-setup-key': process.env.SETUP_KEY }, body: { email: 'x@example.com' } })).status === 409);
check('bootstrap refuses wrong key', (await api('/bootstrap', { method: 'POST', headers: { 'x-setup-key': 'nope-nope-nope-nope' }, body: { email: 'x@example.com' } })).status === 403);

// 2. admin sets password via link
const A = await newCtx();
await A.page.goto(boot.body.setup_url.replace(/^https?:\/\/[^/]+/, BASE));
await A.page.waitForSelector('#who:not(:empty)');
await A.page.fill('[name=password]', 'admin-password-123'); await A.page.fill('[name=confirm]', 'admin-password-123');
await A.page.click('button[type=submit]');
await A.page.waitForURL('**/portal/admin'); await A.page.waitForSelector('h1');
check('admin setup lands on admin console', /Clients & prospects/.test(await A.page.textContent('h1')));
check('setup link cannot be reused', (await api('/setup?token=' + new URL(boot.body.setup_url).searchParams.get('token'))).status === 410);

// 3. admin creates a prospect account
await A.page.click('text=+ New account');
await A.page.fill('[name=business_name]', 'Tall Pine Cottage Co. (test)');
await A.page.fill('[name=contact_name]', 'Lori Test');
await A.page.fill('[name=email]', 'client@example.com');
await A.page.fill('[name=next_step]', 'Free call booked for Tuesday at 10 AM');
await A.page.click('text=Create account and get setup link');
await A.page.waitForSelector('.linkbox input');
const clientLink = await A.page.inputValue('.linkbox input');
check('account created with setup link', /setup\?token=[a-f0-9]{64}/.test(clientLink));
if (SHOTS) await A.page.screenshot({ path: SHOTS + '/admin-created.png' });
await A.page.click('text=Open the account');
await A.page.waitForSelector('text=What the client sees');

// add an approval, a report, a document, an invoice; move stage to read-only
const addItem = async (sectionTitle, fill) => {
  const card = A.page.locator('.card', { has: A.page.locator('p.label', { hasText: sectionTitle }) }).first();
  await card.locator('summary').click();
  await fill(card);
  await card.locator('button[type=submit]', { hasText: 'Add' }).click();
  await A.page.waitForResponse((r) => r.url().includes('/api/portal/admin/accounts/') && r.request().method() === 'GET');
  await A.page.waitForSelector('text=What the client sees');
};
await addItem('Waiting on them', async (c) => { await c.locator('[name=title]').fill('Approve the new booking reply wording'); await c.locator('[name=detail]').fill('Hi! Thanks for reaching out about the cottage.'); });
await addItem('Morning reports', async (c) => { await c.locator('[name=summary]').fill('1 waiting on you · 3 inquiries answered'); await c.locator('[name=handled]').fill('3 rental inquiries answered within 5 minutes.'); });
await addItem('Documents', async (c) => { await c.locator('[name=name]').fill('Service agreement'); await c.locator('[name=url]').fill('https://minutesregained.com/agreement'); });
await addItem('Invoices', async (c) => { await c.locator('[name=invoice_date]').fill('2026-11-01'); await c.locator('[name=amount_cents]').fill('65000'); });
await A.page.selectOption('form >> [name=stage]', 'read_only');
await A.page.fill('form >> [name=plan]', 'Essential');
await A.page.fill('form >> [name=plan_price_cents]', '65000');
await A.page.fill('form >> [name=hours_included]', '4');
await A.page.click('text=Save details');
await A.page.waitForSelector('text=Saved.');
check('admin added approval/report/doc/invoice + stage', true);

// 4. client signs up and uses the portal
const C = await newCtx();
await C.page.goto(clientLink.replace(/^https?:\/\/[^/]+/, BASE));
await C.page.waitForSelector('#who:not(:empty)');
check('setup page names the business', /Tall Pine/.test(await C.page.textContent('#who')));
check('token removed from address bar', !C.page.url().includes('token='));
await C.page.fill('[name=password]', 'short'); await C.page.fill('[name=confirm]', 'short'); await C.page.click('button[type=submit]');
check('short password rejected', /10 characters/.test(await C.page.textContent('#err')));
await C.page.fill('[name=password]', 'client-password-123'); await C.page.fill('[name=confirm]', 'client-password-123');
await C.page.click('button[type=submit]');
await C.page.waitForURL('**/portal/app'); await C.page.waitForSelector('.hello h1');
const overview = await C.page.textContent('#view');
check('client overview shows next step', overview.includes('Free call booked for Tuesday'));
check('client overview shows report', overview.includes('3 rental inquiries answered'));
check('approvals badge = 1', (await C.page.textContent('.badge')) === '1');
if (SHOTS) await C.page.screenshot({ path: SHOTS + '/client-overview.png', fullPage: true });

await C.page.click('text=Getting started');
check('tracker shows read-only as current', /Now: Nothing sends/.test(await C.page.textContent('.track li.now')));
if (SHOTS) await C.page.screenshot({ path: SHOTS + '/client-tracker.png', fullPage: true });

await C.page.click('.tab:has-text("Waiting on you")');
await C.page.click('button:has-text("Approve")');
await C.page.waitForSelector('.appr.done');
check('client approves item', /Approved/.test(await C.page.textContent('.appr.done')));

await C.page.click('.tab:has-text("Requests")');
await C.page.fill('[name=body]', 'Add Saturday hours to the booking reply');
await C.page.click('button:has-text("Send request")');
await C.page.waitForSelector('text=Add Saturday hours to the booking reply');
check('client sends request', true);

await C.page.click('.tab:has-text("Plan & billing")'); await C.page.waitForSelector('h1:has-text("Plan & billing")');
check('billing shows plan + invoice', /Essential/.test(await C.page.textContent('#view')) && /\$650/.test(await C.page.textContent('#view')));
await C.page.click('.tab:has-text("Documents")'); await C.page.waitForSelector('h1:has-text("Documents")');
check('documents list', /Service agreement/.test(await C.page.textContent('#view')));

// 5. admin sees the request and closes it with hours
await A.page.reload(); await A.page.waitForSelector('text=Requests from the client');
check('admin sees approval decision', /approved/.test(await A.page.textContent('#view')));
const reqCard = A.page.locator('.itemrow', { hasText: 'Add Saturday hours' });
await reqCard.locator('[name=status]').selectOption('Done');
await reqCard.locator('[name=hours]').fill('0.5');
await reqCard.locator('[name=reply]').fill('Done. Saturday 9 to 1 is now in the reply.');
await reqCard.locator('button:has-text("Update")').click();
await A.page.waitForResponse((r) => r.url().includes('/api/portal/admin/accounts/') && r.request().method() === 'GET');
await A.page.waitForSelector('text=What the client sees');
check('hours used rolled up', (await A.page.inputValue('form >> [name=hours_used]')) === '0.5');
if (SHOTS) await A.page.screenshot({ path: SHOTS + '/admin-account.png', fullPage: true });
await A.page.click('text=← All accounts'); await A.page.waitForSelector('table');
if (SHOTS) await A.page.screenshot({ path: SHOTS + '/admin-pipeline.png' });

// 6. security boundaries
const cookies = await C.ctx.cookies();
const sess = cookies.find((c) => c.name === 'mr_portal');
check('session cookie is HttpOnly + Secure + Lax', sess && sess.httpOnly && sess.secure && sess.sameSite === 'Lax');
const asClient = (p, o = {}) => api(p, { ...o, headers: { cookie: 'mr_portal=' + sess.value, ...(o.headers || {}) } });
check('client blocked from admin API', (await asClient('/admin/accounts')).status === 403);
check('no cookie -> 401', (await api('/dashboard')).status === 401);
check('cross-site POST blocked', (await asClient('/requests', { method: 'POST', headers: { origin: 'https://evil.example' }, body: { body: 'x' } })).status === 403);
check('form-encoded POST refused', (await fetch(BASE + '/api/portal/requests', { method: 'POST', headers: { cookie: 'mr_portal=' + sess.value, 'content-type': 'application/x-www-form-urlencoded' }, body: 'body=x' })).status === 415);
const otherAppr = await asClient('/approvals/apr_doesnotexist', { method: 'POST', body: { decision: 'approve' } });
check('cannot touch unknown approval', otherAppr.status === 404);
let last;
for (let i = 0; i < 6; i++) last = await api('/login', { method: 'POST', body: { email: 'client@example.com', password: 'wrong-password' } });
check('lockout after repeated bad passwords', last.status === 429, String(last.status));
const unknown = await api('/login', { method: 'POST', body: { email: 'nobody@example.com', password: 'whatever' } });
check('unknown email gives same generic error', unknown.status === 401 && /don't match/.test(unknown.body.error));
check('no CSP or JS errors in browser', cspErrors.length === 0, cspErrors.slice(0, 3).join(' | '));

// phone layout
const P = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await C.ctx.storageState() });
const pp = await P.newPage(); await pp.goto(BASE + '/portal/app'); await pp.waitForSelector('.hello h1');
const sw = await pp.evaluate(() => document.documentElement.scrollWidth);
check('portal fits a phone (no sideways scroll)', sw <= 391, 'scrollWidth=' + sw);
if (SHOTS) await pp.screenshot({ path: SHOTS + '/client-phone.png', fullPage: true });

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
