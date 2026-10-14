/**
 * Minutes Regained -- Workspace agent (Google Apps Script)
 *
 * Runs inside support@minutesregained.com on Google's servers. No Claude
 * usage, no connectors.
 *
 * What it does:
 *   - Every hour: sorts new inbox mail into MR/ labels, flags customer email
 *     you haven't answered within 1 business day, and writes (never sends)
 *     one friendly follow-up draft for emails you sent that got no reply.
 *   - 8 AM and 8 PM Eastern: emails you an Inbox brief (needs you,
 *     unanswered, drafts waiting for your OK, calendar, what was sorted).
 *
 * What it never does: send email to anyone but you, delete, archive, trash,
 * or touch payments. Organizing = labels only. Replies = drafts only.
 *
 * Setup: paste this file into a new Apps Script project, choose `setup` in
 * the toolbar, click Run, and approve Google's permission screen.
 */

const CONFIG = {
  myEmail: 'support@minutesregained.com',
  timeZone: 'America/New_York',
  signerName: 'Jerome',
  signature: [
    'Minutes Regained · support@minutesregained.com · (877) 896-8784',
    'Provident Watch LLC · 7901 4th St N #36617, St. Petersburg, FL 33702',
  ].join('\n'),
  followUpAfterDays: 2,     // follow up on your sent email after this many days of silence
  maxDraftsPerRun: 10,
  // Paying clients: add their email addresses or domains here, e.g. 'firstcoastcarpetcare.com'.
  clients: [],
  // Tools and services you pay for or use.
  vendorDomains: [
    'stripe.com', 'cloudflare.com', 'google.com', 'resend.com', 'resend.dev',
    'elevenlabs.io', 'northwestregisteredagent.com', 'formsubmit.co',
    'anthropic.com', 'github.com', 'heygen.com', 'canva.com', '800.com', 'openai.com',
  ],
};

const LABELS = {
  needsYou: 'MR/Needs-You',
  leads: 'MR/Leads',
  clients: 'MR/Clients',
  billing: 'MR/Billing',
  vendors: 'MR/Vendors',
  lowPriority: 'MR/Low-Priority',
  followUpDrafted: 'MR/Follow-Up-Drafted',
};

// ---------------------------------------------------------------- setup ---

function setup() {
  getLabel_('MR');
  Object.values(LABELS).forEach(getLabel_);

  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('organizeInbox').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('sendInboxBrief').timeBased().atHour(8).everyDays(1).inTimezone(CONFIG.timeZone).create();
  ScriptApp.newTrigger('sendInboxBrief').timeBased().atHour(20).everyDays(1).inTimezone(CONFIG.timeZone).create();

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('lastRunSec')) {
    props.setProperty('lastRunSec', String(Math.floor(Date.now() / 1000) - 2 * 86400));
  }

  organizeInbox();
  sendInboxBrief();
  Logger.log('Setup complete. Check your inbox for the first Inbox brief.');
}

// ------------------------------------------------------------- hourly ----

function organizeInbox() {
  const props = PropertiesService.getScriptProperties();
  const nowSec = Math.floor(Date.now() / 1000);
  const lastRunSec = Number(props.getProperty('lastRunSec')) || nowSec - 86400;
  const sorted = JSON.parse(props.getProperty('sortedCounts') || '{}');

  // 1. Sort new inbox mail.
  const fresh = GmailApp.search('in:inbox after:' + lastRunSec, 0, 100);
  fresh.forEach((thread) => {
    const msg = latestInbound_(thread);
    if (!msg) return;
    classify_(msg).forEach((name) => {
      getLabel_(name).addToThread(thread);
      sorted[name] = (sorted[name] || 0) + 1;
    });
  });

  // 2. Customer email you haven't answered within 1 business day.
  GmailApp.search('in:inbox newer_than:14d {label:mr-leads label:mr-clients}', 0, 50).forEach((thread) => {
    const last = latestMessage_(thread);
    if (!last || isMe_(last.getFrom()) || isOwnSystem_(last.getFrom())) return;
    if (new Date() > addBusinessDays_(last.getDate(), 1)) getLabel_(LABELS.needsYou).addToThread(thread);
  });

  // 3. Follow-up drafts for your sent email that got no reply.
  const drafted = JSON.parse(props.getProperty('draftsCreated') || '[]');
  let made = 0;
  const query = 'in:sent newer_than:21d older_than:' + CONFIG.followUpAfterDays + 'd -label:mr-follow-up-drafted';
  GmailApp.search(query, 0, 50).some((thread) => {
    if (made >= CONFIG.maxDraftsPerRun) return true;
    if (hasAnyLabel_(thread, [LABELS.vendors, LABELS.billing, LABELS.lowPriority])) return false;
    const all = thread.getMessages();
    if (all.some((m) => m.isDraft())) return false;            // a draft is already waiting
    const last = all[all.length - 1];
    if (!isMe_(last.getFrom())) return false;                 // they replied
    const to = externalRecipients_(last);
    if (!to.length) return false;

    const body = followUpBody_(to[0], last);
    let draft = last.createDraftReplyAll(body);
    if (!draft.getMessage().getTo().toLowerCase().includes(emailOf_(to[0]))) {
      draft.deleteDraft();                                      // never address a follow-up to ourselves
      draft = GmailApp.createDraft(to.join(', '), 'Re: ' + last.getSubject(), body);
    }
    getLabel_(LABELS.followUpDrafted).addToThread(thread);
    drafted.push({ to: to[0], subject: last.getSubject() });
    made++;
    return false;
  });

  props.setProperties({
    lastRunSec: String(nowSec),
    sortedCounts: JSON.stringify(sorted),
    draftsCreated: JSON.stringify(drafted.slice(-30)),
  });
}

// ------------------------------------------------------------- brief -----

function sendInboxBrief() {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const isMorning = Number(Utilities.formatDate(now, CONFIG.timeZone, 'H')) < 12;
  const sorted = JSON.parse(props.getProperty('sortedCounts') || '{}');
  const drafted = JSON.parse(props.getProperty('draftsCreated') || '[]');

  const needsYou = GmailApp.search('in:inbox label:mr-needs-you', 0, 20);
  const waiting = GmailApp.search('in:sent newer_than:14d', 0, 50).filter((t) => {
    const last = latestMessage_(t);
    return last && isMe_(last.getFrom()) && externalRecipients_(last).length;
  });

  const lines = [];
  lines.push(`${isMorning ? 'Good morning' : 'Good evening'}. Here's your inbox and calendar.`, '');

  lines.push(`NEEDS YOU (${needsYou.length})`);
  if (!needsYou.length) lines.push('Nothing right now.');
  needsYou.forEach((t) => {
    const m = latestMessage_(t);
    lines.push(`- ${nameOf_(m.getFrom())}: "${t.getFirstMessageSubject()}" (${ago_(m.getDate())})`);
    lines.push(`  ${threadLink_(t)}`);
  });
  lines.push('');

  lines.push(`FOLLOW-UP DRAFTS WAITING FOR YOUR OK (${drafted.length})`);
  if (!drafted.length) lines.push('None.');
  drafted.forEach((d) => lines.push(`- To ${nameOf_(d.to)}: "Re: ${d.subject}"`));
  if (drafted.length) lines.push('  Open Gmail > Drafts, read each one, edit if needed, and press Send.');
  lines.push('');

  lines.push(`WAITING ON REPLIES (${waiting.length})`);
  lines.push(waiting.length ? 'Emails you sent in the last 14 days that have no answer yet.' : 'None.');
  lines.push('');

  lines.push('CALENDAR');
  [['Today', now], ['Tomorrow', new Date(now.getTime() + 86400000)]].forEach(([label, day]) => {
    const events = CalendarApp.getDefaultCalendar().getEventsForDay(day);
    lines.push(`${label}: ${events.length ? '' : 'nothing scheduled'}`);
    events.forEach((e) => lines.push(`- ${e.isAllDayEvent() ? 'All day' : Utilities.formatDate(e.getStartTime(), CONFIG.timeZone, 'h:mm a')}  ${e.getTitle()}`));
  });
  lines.push('');

  const short = (n) => n.replace('MR/', '').replace('-', ' ');
  const counts = Object.keys(sorted).map((k) => `${short(k)} ${sorted[k]}`).join(' · ');
  lines.push('SORTED SINCE LAST BRIEF', counts || 'No new mail.', '');
  lines.push('Your Workspace agent only labels and drafts. It never sends anything except this brief to you, and never deletes or archives.');

  const subject = `${isMorning ? 'Morning' : 'Evening'} inbox brief: ${Utilities.formatDate(now, CONFIG.timeZone, 'EEEE, MMM d')}` +
    (needsYou.length ? ` -- ${needsYou.length} need${needsYou.length === 1 ? 's' : ''} you` : '');
  GmailApp.sendEmail(CONFIG.myEmail, subject, lines.join('\n'), { name: 'Minutes Regained Agent' });

  props.setProperties({ sortedCounts: '{}', draftsCreated: '[]' });
}

// ------------------------------------------------------------ sorting ----

function classify_(msg) {
  const from = msg.getFrom().toLowerCase();
  const subject = (msg.getSubject() || '').toLowerCase();
  const domain = emailOf_(from).split('@')[1] || '';

  if (from.includes('notifications@minutesregained.com')) {
    if (/brief:/.test(subject)) return [];                       // your own briefs stay as they are
    if (/\btest\b|we got your message/.test(subject)) return [LABELS.lowPriority];
    if (subject.startsWith('[needs you]')) return [LABELS.needsYou];
    if (subject.startsWith('[auto-answered]')) return [LABELS.leads];
    return [];
  }
  if (isMe_(from)) return [];
  if (domain.includes('northwestregisteredagent')) return [LABELS.needsYou, LABELS.vendors];  // legal/state mail
  if (/payment (failed|declined)|past due|card (was )?declined|action required|final notice/.test(subject)) {
    return [LABELS.needsYou, LABELS.billing];
  }
  if (CONFIG.clients.some((c) => from.includes(c.toLowerCase()))) return [LABELS.clients];
  if (/receipt|invoice|payment|billing|subscription|charged|renewal|statement/.test(subject)) return [LABELS.billing];
  if (CONFIG.vendorDomains.some((d) => domain === d || domain.endsWith('.' + d))) return [LABELS.vendors];
  if (msg.getHeader('List-Unsubscribe') || /no-?reply|newsletter|marketing|mailer|digest|notifications?@/.test(from)) {
    return [LABELS.lowPriority];
  }
  return [LABELS.leads];                                         // a real person writing in
}

// ------------------------------------------------------------ helpers ----

function followUpBody_(recipient, lastMsg) {
  const sent = Utilities.formatDate(lastMsg.getDate(), CONFIG.timeZone, 'EEEE, MMM d');
  return [
    `Hi ${firstName_(recipient)},`,
    '',
    `Just following up on my note from ${sent} about "${lastMsg.getSubject()}". ` +
      'Any questions I can answer, or is there a good time to talk this week?',
    '',
    CONFIG.signerName,
    CONFIG.signature,
  ].join('\n');
}

const labelCache_ = {};
function getLabel_(name) {
  if (!labelCache_[name]) labelCache_[name] = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
  return labelCache_[name];
}

function hasAnyLabel_(thread, names) {
  const have = thread.getLabels().map((l) => l.getName());
  return names.some((n) => have.includes(n));
}

function latestMessage_(thread) {
  const msgs = thread.getMessages().filter((m) => !m.isDraft());
  return msgs[msgs.length - 1];
}

function latestInbound_(thread) {
  const msgs = thread.getMessages().filter((m) => !m.isDraft() && !isMe_(m.getFrom()));
  return msgs[msgs.length - 1];
}

function externalRecipients_(msg) {
  return [msg.getTo(), msg.getCc()].join(',').split(',').map((s) => s.trim()).filter((r) => {
    const e = emailOf_(r);
    const domain = e.split('@')[1] || '';
    return e && !isMe_(e) && !isOwnSystem_(e) && !/no-?reply/.test(e) &&
      !CONFIG.vendorDomains.some((d) => domain === d || domain.endsWith('.' + d));
  });
}

function emailOf_(s) {
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim().toLowerCase();
}

function nameOf_(s) {
  const m = String(s).match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1] : emailOf_(s);
}

function firstName_(s) {
  const m = String(s).match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].split(/\s+/)[0] : 'there';
}

function isMe_(s) { return String(s).toLowerCase().includes(CONFIG.myEmail); }
function isOwnSystem_(s) { return String(s).toLowerCase().includes('@minutesregained.com'); }

function addBusinessDays_(date, n) {
  const d = new Date(date);
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n--;
  }
  return d;
}

function ago_(date) {
  const hours = Math.round((Date.now() - date.getTime()) / 3600000);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function threadLink_(thread) {
  return 'https://mail.google.com/mail/u/0/#all/' + thread.getId();
}
