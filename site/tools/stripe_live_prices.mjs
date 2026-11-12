#!/usr/bin/env node
// Creates the four recurring Prices in Stripe that checkout looks up by lookup key
// (site/src/plans.js). Run it once, after the live Stripe account is activated.
//
//   STRIPE_KEY=sk_live_... node site/tools/stripe_live_prices.mjs           # shows what it would do
//   STRIPE_KEY=sk_live_... node site/tools/stripe_live_prices.mjs --create  # creates what's missing
//
// - Never creates a Price whose lookup key already exists; it checks the amount
//   and interval of the existing one instead, so running it twice is safe.
// - Refuses to --create with a test key unless --test is also given.
// - Amounts come from plans.js, the same numbers the signed agreement shows.

import { pathToFileURL } from "node:url";
import { PLANS, RETAINER_MONTHS } from "../src/plans.js";

const API = "https://api.stripe.com/v1";
const PRODUCT_NAME = "Minutes Regained service plan";

export function wanted() {
  const out = [];
  for (const [id, p] of Object.entries(PLANS)) {
    out.push({ lookup_key: p.lookupKey, amount: p.priceCents, interval: "month", nickname: `${p.label}, monthly` });
    out.push({ lookup_key: p.retainerLookupKey, amount: p.retainerCents * RETAINER_MONTHS, interval: "year", nickname: `${p.label}, 12-month Retainer` });
  }
  return out;
}

async function stripe(key, method, path, params) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${data.error ? data.error.message : res.status}`);
  return data;
}

export async function run({ key, create = false, allowTest = false, log = console.log }) {
  if (!key) throw new Error("Set STRIPE_KEY to the account's secret key.");
  const account = await stripe(key, "GET", "/account");
  const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  log(`Account: ${(account.business_profile || {}).name || account.id}. Charges enabled: ${account.charges_enabled}. Payouts enabled: ${account.payouts_enabled}.`);
  if (create && !live && !allowTest) throw new Error("This is not a live key. Add --test to create test-mode Prices on purpose.");
  if (create && live && !account.charges_enabled) throw new Error("The live account can't take charges yet. Finish Stripe's activation first.");

  const keys = wanted().map((w) => w.lookup_key);
  const found = await stripe(key, "GET", `/prices?active=true&limit=100&${keys.map((k) => `lookup_keys[]=${encodeURIComponent(k)}`).join("&")}`);
  const byKey = new Map(found.data.map((p) => [p.lookup_key, p]));
  let product = null;
  const report = [];
  for (const w of wanted()) {
    const have = byKey.get(w.lookup_key);
    if (have) {
      const ok = have.unit_amount === w.amount && have.currency === "usd" && have.recurring && have.recurring.interval === w.interval;
      report.push({ ...w, status: ok ? "exists, matches" : `exists, DOES NOT MATCH (${have.unit_amount} per ${have.recurring && have.recurring.interval})`, id: have.id });
      continue;
    }
    if (!create) { report.push({ ...w, status: "missing (would create)" }); continue; }
    if (!product) {
      const existing = await stripe(key, "GET", `/products/search?query=${encodeURIComponent(`name:'${PRODUCT_NAME}' AND active:'true'`)}`);
      product = existing.data[0] || await stripe(key, "POST", "/products", { name: PRODUCT_NAME });
    }
    const p = await stripe(key, "POST", "/prices", {
      product: product.id, currency: "usd", unit_amount: String(w.amount), "recurring[interval]": w.interval,
      lookup_key: w.lookup_key, nickname: w.nickname,
    });
    report.push({ ...w, status: "created", id: p.id });
  }
  for (const r of report) log(`${r.lookup_key.padEnd(34)} $${(r.amount / 100).toLocaleString("en-US")} per ${r.interval}: ${r.status}${r.id ? ` (${r.id})` : ""}`);
  if (!create) log("Nothing was created. Add --create to create what's missing.");
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const args = process.argv.slice(2);
  run({ key: process.env.STRIPE_KEY, create: args.includes("--create"), allowTest: args.includes("--test") })
    .catch((err) => { console.error(`Stopped: ${err.message}`); process.exit(1); });
}
