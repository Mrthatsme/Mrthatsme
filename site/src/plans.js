// Mirrors the plan cards in public/index.html's #pricing section and the
// plan picker in public/start.html. priceCents is the STANDARD monthly price.
// A 12-month Retainer is 10% off and paid in full for the year at sign-up
// (its own yearly Stripe Price); it renews yearly with 30 days' notice.

export const RETAINER_DISCOUNT = 0.1;

// The five core automations, by name. Keep in step with the homepage.
export const CORE_AUTOMATIONS = ["Lead Catcher", "Quote Chaser", "Schedule Keeper", "Review Builder", "Invoice & Chase"];

// Operations+ is retired (November 6, 2026). Custom Automation is scoped on a
// call and is not sold through /start.
export const PLANS = {
  essential: {
    label: "Essential",
    priceCents: 65000,
    retainerCents: 58500,
    envKey: "STRIPE_PRICE_ESSENTIAL",
    lookupKey: "monthly_essential",
    retainerLookupKey: "retainer_yearly_essential",
    retainerEnvKey: "STRIPE_PRICE_ESSENTIAL_RETAINER",
    automations: 3, coreLine: "3 of the 5 core automations", hours: 4, rollover: "Unused hours roll over 1 month",
    extraHourly: 95, softwareAllowance: 50, inboxes: 1, reviewCall: null, voiceNotes: 100,
  },
  business_support: {
    label: "Business Support",
    priceCents: 130000,
    retainerCents: 117000,
    envKey: "STRIPE_PRICE_BUSINESS_SUPPORT",
    lookupKey: "monthly_business_support",
    retainerLookupKey: "retainer_yearly_business_support",
    retainerEnvKey: "STRIPE_PRICE_BUSINESS_SUPPORT_RETAINER",
    automations: 6, coreLine: "All 5 core automations, plus 1 custom automation", hours: 8, rollover: "Unused hours roll over 1 month",
    extraHourly: 95, softwareAllowance: 100, inboxes: 2, reviewCall: "30-minute monthly review call", voiceNotes: 250,
  },
};

// Founding-client offer (set November 10, 2026): the first three clients on
// Business Support lock the standard monthly price for 24 months, whatever the
// published price becomes, and get one process map of their operation free in
// the first month. No discount, so it uses the standard Business Support Stripe
// Price. Monthly billing only.
export const FOUNDING_OFFER = {
  planId: "business_support",
  label: "Business Support (Founding Client)",
  lockMonths: 24,
  maxClients: 3,
};

// Voice notes beyond the plan's monthly allowance: $10 for each extra 100 or
// part of 100. Monthly clients see it on their next invoice; Retainer clients
// get a separate invoice for that month. Unused notes don't roll over.
export const VOICE_OVERAGE = { blockSize: 100, blockCents: 1000 };

export const BILLING_OPTIONS = ["monthly", "retainer"];

export const RETAINER_MONTHS = 12;

export function normalizeBilling(billing) {
  return billing === "retainer" ? "retainer" : "monthly";
}

export function resolvePlan(planId, founding, billing = "monthly") {
  const base = PLANS[planId];
  if (!base) return null;
  billing = normalizeBilling(billing);
  const afterCents = billing === "retainer" ? base.retainerCents : base.priceCents;
  if (founding) {
    // The founding offer is monthly billing only.
    if (planId !== FOUNDING_OFFER.planId || billing !== "monthly") return null;
    return { id: planId, ...base, ...FOUNDING_OFFER, billing, priceCents: base.priceCents, standardCents: base.priceCents, planName: base.label,
      chargeCents: base.priceCents, interval: "month", envKey: base.envKey, lookupKey: base.lookupKey };
  }
  return {
    id: planId,
    ...base,
    billing,
    label: billing === "retainer" ? `${base.label} (12-month Retainer)` : base.label,
    priceCents: afterCents,
    standardCents: base.priceCents,
    planName: base.label,
    // What Stripe actually charges each billing period: one month, or the whole year.
    chargeCents: billing === "retainer" ? afterCents * RETAINER_MONTHS : afterCents,
    interval: billing === "retainer" ? "year" : "month",
    envKey: billing === "retainer" ? base.retainerEnvKey : base.envKey,
    lookupKey: billing === "retainer" ? base.retainerLookupKey : base.lookupKey,
  };
}
