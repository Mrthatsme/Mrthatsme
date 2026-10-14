// Mirrors the plan cards in public/index.html's #pricing section and the
// plan picker in public/start.html. priceCents is the STANDARD monthly price;
// a 12-month Retainer is 10% off, billed monthly, as its own Stripe Price.

export const RETAINER_DISCOUNT = 0.1;

export const PLANS = {
  essential: {
    label: "Essential",
    priceCents: 45000,
    retainerCents: 40500,
    envKey: "STRIPE_PRICE_ESSENTIAL",
    retainerEnvKey: "STRIPE_PRICE_ESSENTIAL_RETAINER",
    automations: 3, hours: 10, rollover: "Unused hours don't roll over",
    extraHourly: 50, softwareAllowance: 50, inboxes: 1, reviewCall: null,
  },
  business_support: {
    label: "Business Support",
    priceCents: 90000,
    retainerCents: 81000,
    envKey: "STRIPE_PRICE_BUSINESS_SUPPORT",
    retainerEnvKey: "STRIPE_PRICE_BUSINESS_SUPPORT_RETAINER",
    automations: 6, hours: 22, rollover: "Unused hours roll over 1 month, up to 5",
    extraHourly: 45, softwareAllowance: 100, inboxes: 2, reviewCall: "30-minute monthly review call",
  },
  operations_plus: {
    label: "Operations+",
    priceCents: 150000,
    retainerCents: 135000,
    envKey: "STRIPE_PRICE_OPERATIONS_PLUS",
    retainerEnvKey: "STRIPE_PRICE_OPERATIONS_PLUS_RETAINER",
    automations: 12, hours: 40, rollover: "Unused hours roll over 1 month, up to 10",
    extraHourly: 40, softwareAllowance: 150, inboxes: 4, reviewCall: "60-minute monthly review call",
  },
};

// Founding-client offer: Business Support (22 hours) at $450/mo for the first
// 90 days, then the standard Business Support price for the billing option
// chosen. Its own Stripe Price; we remind the client 14 days before it ends.
export const FOUNDING_OFFER = {
  planId: "business_support",
  label: "Business Support (Founding Client offer)",
  priceCents: 45000,
  envKey: "STRIPE_PRICE_FOUNDING_OFFER",
  maxClients: 3,
};

export const BILLING_OPTIONS = ["monthly", "retainer"];

export function normalizeBilling(billing) {
  return billing === "retainer" ? "retainer" : "monthly";
}

export function resolvePlan(planId, founding, billing = "monthly") {
  const base = PLANS[planId];
  if (!base) return null;
  billing = normalizeBilling(billing);
  const afterCents = billing === "retainer" ? base.retainerCents : base.priceCents;
  if (founding) {
    if (planId !== FOUNDING_OFFER.planId) return null;
    return { id: planId, ...base, ...FOUNDING_OFFER, billing, afterFoundingCents: afterCents };
  }
  return {
    id: planId,
    ...base,
    billing,
    label: billing === "retainer" ? `${base.label} (12-month Retainer)` : base.label,
    priceCents: afterCents,
    envKey: billing === "retainer" ? base.retainerEnvKey : base.envKey,
  };
}
