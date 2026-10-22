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
