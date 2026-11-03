// Grounding source for the triage agent -- keep this in sync with the FAQ
// array in public/site.js (same content, different runtime). If you edit
// the FAQ on the site, mirror the edit here or the agent will be answering
// from stale published info.

export const FAQ = [
  ["Do you need my password?",
   "No. You don't hand us your passwords, and there's nothing to install on your computer or phone. You add us the way you'd add a new employee: Gmail calls it “grant access,” and Google Calendar, your Google listing, Jobber, Housecall Pro, QuickBooks and Square each have a team or user page. You choose what we can see and remove us yourself in seconds. The one exception, and only if you choose it: if one of your tools has no way to add a user, you can share that one login through 1Password, from your own vault or into a vault we keep for you alone that you can see and empty at any time. A person uses it, never the automated system. We never accept a bank, card or payroll login, or the login to your main email account, and you change any shared password when we part ways. The steps are at minutesregained.com/access."],
  ["Can it spend my money or run a card?",
   "No. Never. Not at any setting and not if you ask. There is no banking credential, no payment login and no transfer tool anywhere in the system. When a card needs charging, you are told and you charge it. Every chargeback and refund stays yours, because we were never near it."],
  ["Can it send quotes or emails without asking me?",
   "Quotes, prices and anything new always wait for your OK. Today everything that goes to your customers is drafted for you to check and send, apart from a short \u201cwe got your message\u201d note so nobody waits in silence. During onboarding you can also approve a short set of replies, in your own words, that go out on their own, and only to people who contacted you first."],
  ["What are the four control levels?",
   "Handle it — do it, don't ask. Tell me — do it, then report. Ask me — draft it and wait. Never — not possible, because no tool exists behind it. You set them per kind of work and change them whenever you like."],
  ["What happens when the internet is down?",
   "We commit to one business day, not an uptime percentage — anyone promising four nines on a service like this is quoting a number they can't be held to. Nothing arriving is lost: your calls, voicemail, email and forms queue with the carriers. And an outage can't produce a wrong action, only a late one, because nothing consequential sends without a person releasing it."],
  ["I can only talk at certain times. Does that work?",
   "That's the normal case, not the exception. You set the days, hours and channel you can be reached, and routine items collect into one digest inside that window instead of pinging all day. A short written list is allowed to break it — a customer cancelling, a filing deadline inside two business days, a no-show, a vendor decision that would cost you, or a supply you need for a booked job. That list is in the agreement, not left to judgment."],
  ["What about emergencies after hours, like a burst pipe?",
   "You tell us what counts as an emergency for your business and who is on call when, and the promise you make, such as a tech within two hours. When one comes in, your on-call person gets the name, address, callback number and the problem right away, and so do you. Outside your business hours, the customer also gets a short automatic note from your assistant saying the team has been alerted; during your hours that note waits in your drafts. Any arrival time goes out only with your OK. We check your inbox every ten minutes, so it reaches your tech within minutes, not the next morning."],
  ["Can bots or spam run up costs on my website?",
   "No. The question box on your site answers from your approved answers with no AI behind it, so a bot asking a thousand questions costs nothing. Contact forms screen out bots with a hidden trap field, a too-fast check and a limit per sender, and every block is counted in your daily brief. Your bill is flat either way."],
  ["What stops someone running up your costs — or mine?",
   "Your monthly fee is flat. The one thing that can add to it is your own voice notes past your plan's monthly allowance, at $10 for each extra 100, and you're emailed at 80% and again when you go over. Bots, spam and other clients can't become a charge to you. Each client also runs under its own ceiling, so one busy month can't degrade anyone else."],
  ["Which AI do you use, and what can it see?",
   "Drafts are written by Claude, from Anthropic. For each draft it sees the one message being answered and your approved wording, and Anthropic does not train on it. Voice notes are turned into text by Cloudflare. To connect Gmail we ask Google for permission to read and organize your mail and save drafts; Google's name for that permission also covers sending, but our system has no send function and never sends from your mailbox. On Microsoft we ask only to read and write mail, not to send. The full list is on our privacy page."],
  ["Is my information mixed in with other clients?",
   "No. Each client has its own email connection, its own assistant and its own records, and every lookup our system makes is limited to the one client it is working for. Your access is stored encrypted and separately from anyone else's. Your information is used to do your work. It is not pooled and it is not used to train anything."],
  ["What if someone tries to trick it?",
   "They will — it's the first thing we planned for. Emails, attachments and web pages are treated as information, never as instructions. And the part that matters more: the dangerous actions have no tool behind them. A convincing email asking us to redirect a payment can't succeed, because nothing in the system can move a payment."],
  ["How long does setup take?",
   "About an hour, once. Granting access, walking through how you actually work, and setting the levels. Then the first two weeks run read-only while you watch — it drafts everything and sends nothing. The trial is part of your first month, not an extra charge."],
  ["How big does my business need to be?",
   "Roughly one to twenty-five people. The fit is situation more than headcount: you need help and you are not ready to hire another full-time person. Industry doesn't matter."],
  ["Do you work with my industry?",
   "Yes. Every small business runs on the same back office: an inbox, a calendar, quotes, invoices and follow-ups. If it's work you'd hand to an assistant, it fits, whether you run a crew, an office, a studio or a shop. Your free assessment is where we learn how your business actually works, everything is set to your rules before anything runs, and anything that needs your professional judgment, like pricing or legal advice, always stays with you."],
  ["Do you text my customers?",
   "No, never. We reply only where the customer reached out, like your website chat or email, and Facebook and Instagram once those are connected. Missed calls go to the top of your daily brief so you can call back."],
  ["Can it handle my Instagram or Facebook messages?",
   "Coming soon. We're adding replies in your Facebook and Instagram inboxes, in words you approve, only to people who messaged you first. Until then we work through your email, website forms and chat, calendar and CRM. We never send text messages."],
  ["What happens if I stop?",
   "You revoke access from inside your own accounts — you don't have to ask us or wait for us. Within five business days you get written confirmation that no access and no copy of your data remains, beyond what tax and business records require. Nothing is held hostage."],
  ["What if it gets something wrong?",
   "It will, eventually. That's the entire reason the levels exist — the work with real consequences waits for you, so a mistake shows up as a bad draft you decline rather than a bad email your customer receives. Start everything at ask-me and loosen it as you see the judgment."],
  ["Is there a contract?",
   "Yes, a short service agreement you sign online. Monthly plans need 30 days' notice to cancel; a 12-month Retainer, paid upfront for the year, saves 10%. Pricing is published rather than quoted on a call, there's no setup fee, and software we use to serve you is included up to your plan's allowance."],
  ["What do you actually do?",
   "We build and run five core automations: Lead Catcher (website chat and lead replies), Quote Chaser (follow-ups on open quotes), Booking & Reminders, Job Wrap-Up (review requests and invoice heads-ups) and your Daily Brief. On top of that we keep your inbox, follow-ups and calendar current. We fix anything that breaks. No setup fee."],
  ["What happens if an automation breaks?",
   "We monitor every automation we build, and we fix breaks at no charge, usually within one business day and often before you notice. Repairs never use your hours."],
  ["If I cancel, do I lose the automations?",
   "No. They live in your own accounts and keep running. We just stop monitoring and maintaining them."],
  ["How many hours do I get?",
   "Every plan includes 10, 22 or 40 hours of a person's time: building new automations, and one-off admin you hand us, like rescheduling a week of jobs or cleaning up your contact list. Automations you've approved never use your hours, however often they run, and neither do monitoring, repairs or your daily brief. Each hands-on task is counted at the time a skilled assistant would take (for example, 5 minutes to schedule an appointment), and your monthly report lists every one. Unused hours roll over one month. We never bill extra hours without asking first."],
  ["Is software included?",
   "Yes. The tools we use to serve you are included in your plan, up to an allowance. We never bill you for software above it: if a tool you'd need costs more, we tell you first and you decide. Your own existing subscriptions, like your email or accounting software, stay yours."],
  ["Can I cancel?",
   "Monthly plans: cancel any time with 30 days' notice. Retainers are paid upfront for 12 months at 10% off. Leave early and we refund the rest of the year, keeping only the 10% discount on the months you used. The first month covers setup and isn't refundable once setup begins."],
  ["Who does the work?",
   "Both, and here's the split. Automations do the routine work you've approved, every day, and never use your hours. A person, the owner of Minutes Regained, sets up your account, does the hands-on admin your hours pay for, fixes anything that breaks, and answers your emails. Nothing important goes out without the approval level you set."],
];

export const PRICING_SUMMARY = `Simple monthly pricing. Software included. No setup fee. Every plan includes automations built and monitored, the daily brief, and hands-on admin (email, scheduling, follow-ups, invoice reminders). Monitoring, repairs and the daily brief never use the client's hours.
Essential: $450/month ($4,860/year on a 12-month Retainer, paid upfront; works out to $405/month) -- up to 3 automations, 10 hours/month (roll over 1 month, max 3), extra hours $50/hr only with approval, software included up to $50/month, 1 inbox, 100 voice notes/month.
Business Support: $900/month ($9,720/year on a 12-month Retainer, paid upfront; works out to $810/month) -- up to 6 automations, 22 hours/month (roll over 1 month, max 5), extra hours $45/hr only with approval, software up to $100/month, 2 inboxes, 250 voice notes/month, 30-minute monthly review call.
Operations+: $1,500/month ($16,200/year on a 12-month Retainer, paid upfront; works out to $1,350/month) -- up to 12 automations, 40 hours/month (roll over 1 month, max 10), extra hours $40/hr only with approval, software up to $150/month, 4 inboxes, 500 voice notes/month, 60-minute monthly review call.
Voice notes over the monthly allowance: $10 per extra 100, added to the next invoice.
Billing: pay monthly (billed each month on the sign-up date) and cancel with 30 days' notice, or save 10% with a 12-month Retainer paid upfront for the year, renewing yearly with a 30-day email notice; leave a Retainer early and the rest of the year is refunded, keeping only the 10% discount on months used. The founding offer is monthly only. The first month covers setup and isn't refundable once setup begins.
Founding Client offer (first 3 clients only): Business Support (22 hours) at $450/month for the first 90 days, then $900/month. The founding offer is monthly billing only.
What we automate: website chat and social replies, instant lead replies, quote follow-ups, appointment reminders, review requests, invoice reminders, daily brief.`;

export function faqAsText() {
  return FAQ.map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n");
}
