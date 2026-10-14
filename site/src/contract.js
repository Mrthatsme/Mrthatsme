// The service agreement shown at the click-to-agree step. Keep this a plain
// template string (no HTML) so its sha256 hash is stable and easy to audit.
// CONTRACT_VERSION bumps whenever the wording changes — old agreements keep
// the version + hash they actually signed.

export const CONTRACT_VERSION = "2026-10-14.1";

const usd = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// plan: the object from resolvePlan() (label, priceCents, billing, hours, ...).
export function contractText({ businessName, plan, foundingOffer }) {
  const retainer = plan.billing === "retainer";
  const priceLine = foundingOffer
    ? `${usd(plan.priceCents)}/month for your first 90 days (Founding Client offer: Business Support, ${plan.hours} hours/month), then ${usd(plan.afterFoundingCents)}/month for Business Support${retainer ? " on the 12-month Retainer" : ""}. Minutes Regained will remind Client 14 days before the price changes.`
    : `${usd(plan.priceCents)}/month for the ${plan.label} plan.`;
  const billingLine = retainer
    ? `12-month Retainer at 10% off the standard monthly price, billed monthly, in
advance, by card on file via Stripe.`
    : `Monthly, in advance, by card on file via Stripe. Month to month.`;
  const termText = retainer
    ? `This agreement runs for twelve (12) months from the start date at the
   Retainer price. If Client ends it early, Client repays only the discount
   received to date (the difference between the standard monthly price and
   the Retainer price for the months already billed), and nothing more.
   Minutes Regained may end it with thirty (30) days' written notice.`
    : `This agreement runs month to month. Either party
   may cancel with thirty (30) days' written notice. There is no long-term
   commitment.`;
  const included = [
    `Up to ${plan.automations} automations built, run and monitored`,
    `${plan.hours} support hours per month for new builds and hands-on admin (${plan.rollover.toLowerCase()})`,
    `Additional hours only with Client's prior written approval, at $${plan.extraHourly}/hour`,
    `Software used to serve Client included, up to $${plan.softwareAllowance}/month`,
    `${plan.inboxes} inbox${plan.inboxes === 1 ? "" : "es"} managed`,
    plan.reviewCall,
    `Daily brief. Monitoring, repairs and the daily brief never use Client's hours`,
  ].filter(Boolean).map((l) => `  - ${l}`).join("\n");

  return `MINUTES REGAINED — SERVICE AGREEMENT

Provider: Minutes Regained, operated by Provident Watch LLC
          7901 4th St N #36617, St. Petersburg, FL 33702
          support@minutesregained.com · (877) 896-8784
Client: ${businessName}
Plan: ${plan.label}
Price: ${priceLine}
Billing: ${billingLine}
No setup fee.
Included each month:
${included}

1. Term and cancellation. ${termText}

2. Scope of control. Client sets and may change, at any time, what Minutes
   Regained's systems are authorized to do, using the four control levels
   published on minutesregained.com (Handle it / Tell me / Ask me / Never).
   No action with a real-world consequence to Client's business or its
   customers is taken without the authorization level Client has set.

3. No financial access on Client's behalf. The payment set up through this
   agreement is Client's monthly fee to Minutes Regained for the service
   described above — nothing more. Minutes Regained will never request or
   store any banking credential or payment login belonging to Client, will
   never have the ability to transfer Client's funds, and will never charge,
   collect, hold, or move money on behalf of Client or Client's customers.
   Where Client's plan includes invoice reminders or paid/unpaid tracking,
   Minutes Regained only sends reminders and reads payment status in
   Client's own tools. Every charge, invoice, and payment is issued and
   collected by Client directly, through Client's own systems.

4. Access and revocation. Client grants access only through the delegated-
   access mechanisms of the platforms Client already uses (e.g. Google
   "grant access"). Client may revoke this access at
   any time, directly, without needing Minutes Regained's involvement. Upon
   cancellation, Minutes Regained will confirm in writing within five (5)
   business days that no access and no copy of Client's data remains,
   beyond what tax and business recordkeeping requires. Automations built
   for Client live in Client's own accounts and keep running after
   cancellation; Minutes Regained simply stops monitoring and maintaining
   them.

5. Data handling. Client's data is kept separate from every other client's
   data. It is used only to perform Client's work. It is not pooled across
   clients and is not used to train any model.

6. Fees and refunds. ${priceLine} This monthly fee is the only payment
   Minutes Regained collects under this agreement, apart from additional
   hours Client has approved in writing in advance at the rate above.
   Minutes Regained never bills, on Client's behalf, any amount owed to
   Client by Client's own customers. Software Minutes Regained uses to serve
   Client is included up to the monthly allowance above; Client's own
   existing subscriptions (such as email or accounting software) remain
   Client's. Each task is counted at the time a skilled assistant would
   take, and Client receives a monthly report listing every task. There is
   no setup fee. The first month's fee covers setup and is not refundable
   once setup begins.

7. No guarantee of uptime. Minutes Regained commits to a one-business-day
   response time, not an uptime percentage. Service interruptions delay
   work; they do not cause an unauthorized action, because nothing with a
   real consequence is sent without Client's prior authorization under the
   control level Client has set.

8. Entire agreement. This document, together with the published control
   levels and FAQ at minutesregained.com referenced above, is the entire
   agreement between the parties for this engagement.

By checking the box and typing your name below, you acknowledge that you
have read this agreement, that you are authorized to sign on behalf of the
Client business named above, and that you agree to its terms.`;
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
