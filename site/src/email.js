// Email notifications via Resend (https://resend.com). Fire-and-forget:
// a failed notification must never break the lead/contract flow it's
// attached to, so callers wrap this in a try/catch and only log on failure.

const RESEND_API = "https://api.resend.com/emails";

const FROM_ADDRESS = "Minutes Regained <notifications@minutesregained.com>";

export async function sendNotificationEmail(env, { to, subject, text, replyTo }) {
  const destination = to || env.NOTIFY_EMAIL;
  if (!env.RESEND_API_KEY || !destination) {
    throw new Error("email not configured: missing RESEND_API_KEY or a destination address");
  }
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [destination],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  return res.json();
}

export function notifyNewClient(env, { clientId, businessName, contactName, contactEmail, planId }) {
  return sendNotificationEmail(env, {
    subject: `New paying client: ${businessName} (${planId})`,
    text: [
      `A new client just completed checkout on minutesregained.com`,
      ``,
      `Business: ${businessName}`,
      `Contact: ${contactName} <${contactEmail}>`,
      `Plan: ${planId}`,
      ``,
      `Client id: ${clientId}`,
      `View in CRM: https://minutesregained.com/api/admin/dashboard`,
    ].join("\n"),
  });
}
