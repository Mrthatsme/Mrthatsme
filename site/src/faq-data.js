// Grounding source for the triage agent -- keep this in sync with the FAQ
// array in public/site.js (same content, different runtime). If you edit
// the FAQ on the site, mirror the edit here or the agent will be answering
// from stale published info.

export const FAQ = [
  ["Do you need my password?",
   "No, and we refuse it if offered. Every system you use can grant access without handing over the account — Gmail calls it “grant access to your account.” You grant it, and you can take it back yourself in about four seconds. Your two-factor never leaves your phone."],
  ["Can it spend my money or run a card?",
   "No. Never. Not at any setting and not if you ask. There is no banking credential, no payment login and no transfer tool anywhere in the system. When a card needs charging, you are told and you charge it. Every chargeback and refund stays yours, because we were never near it."],
  ["Can it send quotes or emails without asking me?",
   "Anything new reaching one of your customers waits for you. One exception, written into the agreement: a holding reply that says we have your message and someone is looking at it. It commits you to no price, no date and no promise — it exists because silence is what loses the customer."],
  ["What are the four control levels?",
   "Handle it — do it, don't ask. Tell me — do it, then report. Ask me — draft it and wait. Never — not possible, because no tool exists behind it. You set them per kind of work and change them whenever you like."],
  ["What happens when the internet is down?",
   "We commit to one business day, not an uptime percentage — anyone promising four nines on a service like this is quoting a number they can't be held to. Nothing arriving is lost: your calls, voicemail, email and forms queue with the carriers. And an outage can't produce a wrong action, only a late one, because nothing consequential sends without a person releasing it."],
  ["I can only talk at certain times. Does that work?",
   "That's the normal case, not the exception. You set the days, hours and channel you can be reached, and routine items collect into one digest inside that window instead of pinging all day. A short written list is allowed to break it — a customer cancelling, a filing deadline inside two business days, a no-show, a vendor decision that would cost you, or a supply you need for a booked job. That list is in the agreement, not left to judgment."],
  ["What stops someone running up your costs — or mine?",
   "Your bill can't move. It's a flat monthly retainer with no usage meter and no overage line, so nobody else's behaviour becomes a charge to you. Each client also runs under its own ceiling, so one busy month can't degrade anyone else."],
  ["Is my information mixed in with other clients?",
   "No. Each client's data sits in its own space and there is no path from one to another. Your information is used to do your work. It is not pooled and it is not used to train anything."],
  ["What if someone tries to trick it?",
   "They will — it's the first thing we planned for. Emails, attachments and web pages are treated as information, never as instructions. And the part that matters more: the dangerous actions have no tool behind them. A convincing email asking us to redirect a payment can't succeed, because nothing in the system can move a payment."],
  ["How long does setup take?",
   "About an hour, once. Granting access, walking through how you actually work, and setting the levels. Then the first two weeks run read-only while you watch — it drafts everything and sends nothing."],
  ["How big does my business need to be?",
   "Roughly one to twenty-five people. The fit is situation more than headcount: you need help and you are not ready to hire another full-time person. Industry doesn't matter."],
  ["Do you work with my industry?",
   "Almost certainly. Industry doesn't matter — trades, cleaning, photographers, designers, studios and shops all fit. What matters is the situation: roughly one to twenty-five people, more admin than you can keep up with, and not ready to hire another full-time person."],
  ["Can it handle my Instagram or Facebook messages?",
   "Not today. We work through your email, your website forms, your calendar and your CRM. Social media DMs and posting aren't part of the service right now, so nothing we set up will message anyone on Instagram or Facebook."],
  ["What happens if I stop?",
   "You revoke access from inside your own accounts — you don't have to ask us or wait for us. Within five business days you get written confirmation that no access and no copy of your data remains, beyond what tax and business records require. Nothing is held hostage."],
  ["What if it gets something wrong?",
   "It will, eventually. That's the entire reason the levels exist — the work with real consequences waits for you, so a mistake shows up as a bad draft you decline rather than a bad email your customer receives. Start everything at ask-me and loosen it as you see the judgment."],
  ["Is there a contract?",
   "Yes, a short service agreement you sign online. Monthly plans need 30 days' notice to cancel; a 12-month Retainer saves 10%. Pricing is published rather than quoted on a call, there's no setup fee, and software we use to serve you is included up to your plan's allowance."],
  ["What do you actually do?",
   "We find the repetitive work eating your week, like missed calls, quote follow-ups, reminders and invoices, then build automations to handle it. Our agents run them daily and fix anything that breaks. Building your first automations is included. No setup fee."],
  ["What happens if an automation breaks?",
   "We monitor every automation we build, and we fix breaks at no charge, usually within one business day and often before you notice. Repairs never use your hours."],
  ["If I cancel, do I lose the automations?",
   "No. They live in your own accounts and keep running. We just stop monitoring and maintaining them."],
  ["How many hours do I get?",
   "Every plan includes a set number of support hours: 10, 22 or 40, used for new builds and hands-on admin. We count each task at the time a skilled assistant would take (for example, 5 minutes to schedule an appointment), and you get a monthly report showing every task. We never bill extra hours without asking first."],
  ["Is software included?",
   "Yes. The tools we use to serve you are included in your plan, up to an allowance. Your own existing subscriptions, like your email or accounting software, stay yours."],
  ["Can I cancel?",
   "Monthly plans: 30 days' notice, anytime. Retainers: 12 months at 10% off. Leave early and you only repay the discount you received. The first month covers setup and isn't refundable once setup begins."],
  ["Who does the work?",
   "AI agents do the work, set up and supervised by a person, and nothing important goes out without your approval level."],
];

export const PRICING_SUMMARY = `Simple monthly pricing. Software included. No setup fee. Every plan includes automations built and monitored, the daily brief, and hands-on admin (email, scheduling, follow-ups, invoice reminders). Monitoring, repairs and the daily brief never use the client's hours.
Essential: $450/month ($405/month on a 12-month Retainer) -- up to 3 automations, 10 hours/month (unused hours don't roll over), extra hours $50/hr only with approval, software included up to $50/month, 1 inbox.
Business Support: $900/month ($810/month on a 12-month Retainer) -- up to 6 automations, 22 hours/month (roll over 1 month, max 5), extra hours $45/hr only with approval, software up to $100/month, 2 inboxes, 30-minute monthly review call.
Operations+: $1,500/month ($1,350/month on a 12-month Retainer) -- up to 12 automations, 40 hours/month (roll over 1 month, max 10), extra hours $40/hr only with approval, software up to $150/month, 4 inboxes, 60-minute monthly review call.
Billing: pay monthly and cancel with 30 days' notice, or save 10% with a 12-month Retainer; leave a Retainer early and only the discount received is repaid. The first month covers setup and isn't refundable once setup begins.
Founding Client offer (first 3 clients only): Business Support (22 hours) at $450/month for the first 90 days, then $900/month ($810 on a Retainer).
What we automate: missed-call text-back, instant lead replies, quote follow-ups, appointment reminders, review requests, invoice reminders, daily brief.`;

export function faqAsText() {
  return FAQ.map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n");
}
