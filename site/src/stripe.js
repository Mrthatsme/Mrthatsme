// Minimal Stripe REST client for the Workers runtime (no stripe-node — it
// assumes Node APIs the Workers runtime doesn't have). Uses fetch + the
// form-encoded Stripe API directly.

const STRIPE_API = "https://api.stripe.com/v1";

function form(obj, prefix = "") {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      parts.push(form(v, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    }
  }
  return parts.join("&");
}

async function stripeRequest(secretKey, path, body) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Stripe request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function createCheckoutSession(secretKey, { priceId, contractId, customerEmail, businessName, planLabel, successUrl, cancelUrl }) {
  return stripeRequest(secretKey, "/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": 1,
    customer_email: customerEmail,
    // The client's billing address: printed on invoices, and what sales tax
    // is worked out from if tax collection is switched on.
    billing_address_collection: "required",
    "subscription_data[description]": `${businessName} · ${planLabel}`,
    "subscription_data[metadata][business_name]": businessName,
    client_reference_id: contractId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "metadata[contract_id]": contractId,
    "subscription_data[metadata][contract_id]": contractId,
  });
}

// Invoices and receipts are addressed to the customer's name, so it is set to
// the business that signed the agreement rather than the cardholder.
export async function updateCustomer(secretKey, customerId, { name, contractId }) {
  return stripeRequest(secretKey, `/customers/${customerId}`, {
    name,
    "metadata[business_name]": name,
    "metadata[contract_id]": contractId,
  });
}

export async function retrieveCheckoutSession(secretKey, sessionId) {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}?expand[]=subscription`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.json();
}

// Verifies the Stripe-Signature header per Stripe's documented scheme
// (HMAC-SHA256 over "<timestamp>.<raw body>", using the webhook secret).
export async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret, toleranceSeconds = 300) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedPayload = `${timestamp}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export async function retrieveSubscription(secretKey, subscriptionId) {
  const res = await fetch(`${STRIPE_API}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.json();
}

// The active Price with this lookup key, or null. Prices are found by a fixed
// name (lookup key) so a price change in Stripe needs no Cloudflare secret.
export async function findPriceByLookupKey(secretKey, lookupKey) {
  const q = new URLSearchParams({ active: "true", limit: "1" });
  q.append("lookup_keys[]", lookupKey);
  const res = await fetch(`${STRIPE_API}/prices?${q}`, { headers: { Authorization: `Bearer ${secretKey}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.data && data.data[0]) || null;
}

export async function retrievePrice(secretKey, priceId) {
  const res = await fetch(`${STRIPE_API}/prices/${encodeURIComponent(priceId)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
  return res.ok ? res.json() : null;
}

// Never charge a different amount from the one the client agreed to.
export function priceMatches(price, { cents, interval }) {
  return !!price && price.active && price.currency === "usd" && price.unit_amount === cents
    && !!price.recurring && price.recurring.interval === interval;
}
