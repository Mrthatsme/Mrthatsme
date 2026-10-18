import { retrieveSubscription } from "./stripe.js";
import { sendNotificationEmail } from "./email.js";
import { resolvePlan } from "./plans.js";

// Retainer clients prepay the year. The agreement promises an email at least
// 30 days before each yearly renewal, stating the date and price. Runs with
// the 8 AM brief; renewal_notices makes it send once per renewal.

const NOTICE_DAYS = 30;
const usd = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export async function sendRenewalNotices(env) {
  if (!env.STRIPE_SECRET_KEY) return 0;
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.business_name, c.contact_name, c.contact_email, c.plan_id, c.stripe_subscription_id
       FROM clients c JOIN contracts k ON k.id = c.contract_id
      WHERE c.status = 'active' AND k.billing = 'retainer' AND c.stripe_subscription_id IS NOT NULL`
  ).all();

  let sent = 0;
  for (const client of results || []) {
    const sub = await retrieveSubscription(env.STRIPE_SECRET_KEY, client.stripe_subscription_id);
    // Newer Stripe API versions keep the period on the subscription item.
    const endSec = sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end;
    if (!endSec || sub.cancel_at_period_end || sub.status !== "active") continue;
    const end = new Date(endSec * 1000);
    const daysLeft = (end - Date.now()) / 86400000;
    if (daysLeft > NOTICE_DAYS || daysLeft <= 0) continue;

    const periodEnd = end.toISOString();
    const claim = await env.DB.prepare(
      `INSERT OR IGNORE INTO renewal_notices (stripe_subscription_id, period_end, client_id, sent_at) VALUES (?, ?, ?, ?)`
    ).bind(client.stripe_subscription_id, periodEnd, client.id, new Date().toISOString()).run();
    if (!claim.meta || !claim.meta.changes) continue; // already sent for this renewal

    const plan = resolvePlan(client.plan_id, false, "retainer");
    const price = sub?.items?.data?.[0]?.price?.unit_amount ?? plan.chargeCents;
    const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" }).format(end);
    const first = String(client.contact_name || "").trim().split(/\s+/)[0] || "there";

    await sendNotificationEmail(env, {
      to: client.contact_email,
      replyTo: "support@minutesregained.com",
      subject: `Your Minutes Regained Retainer renews on ${date}`,
      text: [
        `Hi ${first},`,
        ``,
        `This is your 30-day notice: the 12-month Retainer for ${client.business_name} (${plan.planName} plan) renews on ${date}.`,
        `On that date your card on file will be charged ${usd(price)} for the next 12 months (10% off the standard ${usd(plan.standardCents)}/month).`,
        ``,
        `Nothing to do if you'd like to continue. To switch to monthly billing or stop instead, just reply before ${date}, or email support@minutesregained.com.`,
        ``,
        `Thank you for working with us,`,
        `Minutes Regained`,
        `support@minutesregained.com · (877) 896-8784`,
      ].join("\n"),
    });
    await sendNotificationEmail(env, {
      subject: `Renewal notice sent: ${client.business_name} renews ${date} (${usd(price)})`,
      text: `The 30-day Retainer renewal notice went to ${client.contact_email}.\nIf they reply to switch or stop, cancel the renewal in Stripe before ${date}.`,
    }).catch((err) => console.error("renewal copy to support failed", err));
    sent++;
  }
  return sent;
}
