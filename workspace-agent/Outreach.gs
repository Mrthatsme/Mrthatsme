/**
 * Minutes Regained -- Outreach (Google Apps Script)
 *
 * Add this as a second file in the same Apps Script project as
 * MinutesRegainedAgent.gs (it reuses CONFIG, getLabel_ and emailOf_ from it).
 *
 * How it works:
 *   - setupOutreach() creates the "Minutes Regained Prospects" sheet in this
 *     account's Drive (support@) with the starting list, and an hourly timer.
 *   - You review the sheet. A prospect is only ever emailed after you type
 *     YES in its Approved column.
 *   - Approved prospects get a short intro email, a follow-up on day 3 and a
 *     last note on day 7 -- weekdays 9 AM to 4 PM Eastern, at most
 *     OUT.dailyCap emails a day.
 *   - The moment someone replies, the sequence stops, the row says
 *     "Replied", and the thread is labeled MR/Needs-You for you to answer.
 *   - "Stop", "unsubscribe" or "not interested" replies stop everything and
 *     that address is never emailed again. Bounces are marked too.
 */

const OUT = {
  sheetTitle: 'Minutes Regained Prospects',
  dailyCap: 15,
  sendHours: [9, 16],          // send window, Eastern, weekdays only
  followUpDays: [3, 7],        // days after the first email
  closeAfterDays: 14,          // no reply by then: mark closed
  bookingUrl: 'https://calendar.app.google/mL2TQQSCAgLAURZC6',
  demoUrl: 'https://minutesregained.com/demo',
  footer: 'This is a business offer from Minutes Regained. Reply "stop" and we won\'t email you again.',
};

const OUT_HEADERS = ['Business', 'Trade', 'City', 'Website', 'Email', 'Contact name', 'Approved', 'Status',
  'First email sent', 'Follow-up 1 sent', 'Follow-up 2 sent', 'Last update', 'Notes', 'Source', 'Thread ID'];
const OUT_COL = {}; OUT_HEADERS.forEach((h, i) => { OUT_COL[h] = i; });

// Starting list (Clay search + each company's own website, 2026-10-18).
const OUT_SEED = [
  ["Big Jag's Exterior Services", 'Pressure washing', 'Jacksonville', 'bigjagsexterior.com', '', '', 'Needs email (website was down)', 'Veteran-owned; 2 people'],
  ['Elite Facility Services', 'Janitorial and handyman', 'Jacksonville', 'elitefacilityservices.com', 'dispatch@elitefacilityservices.com', '', 'Ready for review', '7 people'],
  ['C&L Landscape', 'Landscaping and remodeling', 'Jacksonville', 'cllandscape.com', 'tessasmith@cllandscape.com', 'Tessa', 'Ready for review', 'Family-owned since 1983; woman-owned'],
  ['TLC Total Lawn Care', 'Commercial lawn care', 'Green Cove Springs', 'tlctotallawncare.com', 'tlcinc@tlc.green', '', 'Ready for review', '8 people'],
  ['Reliable Ducts Heating & Cooling', 'HVAC', 'Jacksonville', 'reliableductsac.com', 'leads@reliableductsac.com', '', 'Ready for review', 'Family-owned 50+ years; 14 people'],
  ['Bemar Construction & Roofing', 'Roofing and repairs', 'Jacksonville', 'bemarconstruction.com', '', '', 'Needs email (website form only)', '8 people'],
  ['1901 Contracting', 'Construction and repair', 'Jacksonville', '1901contracting.com', '', '', 'Needs email (website was down)', '3 people'],
  ['Rhino Shield of Florida', 'Exterior coatings and painting', 'Jacksonville', 'rhinoshieldjax.com', '', '', 'Needs email (website form only)', '13 people'],
  ['Ocean State Heating & Air', 'HVAC', 'Neptune Beach', 'oceanstateac.com', 'gjones@oceanstateac.com', '', 'Ready for review', 'Since 1975; 12 people'],
  ['NEXGEN Roofing', 'Roofing', 'Jacksonville', 'nexgenfl.com', 'info@nexgenfl.com', '', 'Ready for review', '32 people'],
  ['Pratt Guys Pools and Outdoor Living', 'Pools and outdoor living', 'Jacksonville', 'prattguys.com', '', '', 'Needs email (website form only)', '20 people'],
  ['Donna Mancini Interiors and Flooring', 'Interiors and flooring', 'Ponte Vedra', 'dmiaf.com', '', '', 'Needs email (website was down)', '4 people'],
  ['Bright Side Painting of Jax', 'Painting', 'Jacksonville Beach', 'brightsidepaintingjax.com', '', '', 'Needs email (website form only)', '4-5 people'],
  ['Bigfoot Roofing & Construction', 'Roofing', 'Jacksonville', 'bigfootroofing.com', 'info@bigfootroofing.com', '', 'Ready for review', '6 people'],
  ['A1 Plumbing Heating AC & Refrigeration', 'Plumbing and HVAC', 'Jacksonville', 'a1phvacr.com', '', '', 'Needs email (website form only)', 'Since 1970; 29 people'],
  ['American Plumbing Contractors', 'Plumbing', 'Jacksonville', 'americanplumbingcontractors.com', '', '', 'Needs email (website form only)', 'Family-owned; 30 people'],
  ['A&T Roofing and Exteriors', 'Roofing', 'Jacksonville', 'atroofingexterior.com', 'info@atroofingexterior.com', '', 'Ready for review', 'Family-owned; 4 people'],
  ['Excel Roofing Contractors', 'Roofing', 'Jacksonville', 'excel-roofing.com', '', '', 'Needs email (website form only)', 'BBB A+; 7 people'],
  ['E2 Roofing', 'Roofing', 'Jacksonville', 'e2roofingjax.com', '', '', 'Needs email (website form only)', '4 people'],
  ['New Leaf Construction', 'Construction', 'Jacksonville', 'newleafci.com', '', '', 'Needs email (website form only)', '19 people'],
  ['Duck Duck Rooter', 'Plumbing, septic and AC', 'St. Johns', 'duckduckrooter.com', '', '', 'Needs email (website form only)', '20 people'],
  ['NorthPort Heating and Air Conditioning', 'HVAC', 'Jacksonville', 'jacksonvilleacservice.com', 'service@jacksonvilleacservice.com', '', 'Ready for review', 'Family-owned; 8 people'],
  ['Crawford Pest Control', 'Pest control', 'Jacksonville', 'crawfordpestcontrol.com', '', '', 'Needs email (website form only)', 'Family-owned; 4 people'],
  ['Recovery Roofing', 'Roofing', 'Jacksonville', 'recoveryroofinginc.com', 'estimating@recoveryroofinginc.com', '', 'Ready for review', '4 people'],
  ['Summit Electrical Contractors', 'Electrical', 'Jacksonville', 'summitelectrical.com', 'contact@summitelectrical.com', '', 'Ready for review', '38 people'],
];

// ------------------------------------------------------------- setup ----

function setupOutreach() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const existing = props.getProperty('outreachSheetId');
  if (existing) {
    ss = SpreadsheetApp.openById(existing);
  } else {
    ss = SpreadsheetApp.create(OUT.sheetTitle);
    const sh = ss.getSheets()[0].setName('Prospects');
    const rows = OUT_SEED.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], '', r[6], '', '', '', '', r[7],
      'Clay search 2026-10-18' + (r[4] ? '; email from their website' : ''), '']);
    sh.getRange(1, 1, 1, OUT_HEADERS.length).setValues([OUT_HEADERS]).setFontWeight('bold').setBackground('#E1ECEA');
    sh.getRange(2, 1, rows.length, OUT_HEADERS.length).setValues(rows);
    sh.setFrozenRows(1);
    sh.getRange(2, OUT_COL['Approved'] + 1, 500, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['YES'], true).setAllowInvalid(false).build());
    sh.autoResizeColumns(1, OUT_HEADERS.length);
    props.setProperty('outreachSheetId', ss.getId());
  }
  getLabel_('MR/Outreach');

  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'runOutreach')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runOutreach').timeBased().everyHours(1).create();

  GmailApp.sendEmail(CONFIG.myEmail, 'Your prospect sheet is ready',
    'Review the list here: ' + ss.getUrl() + '\n\nType YES in the Approved column for each business you want emailed. ' +
    'Nothing is sent until you do. Emails go out weekdays 9 AM to 4 PM, at most ' + OUT.dailyCap + ' a day.',
    { name: 'Minutes Regained Agent' });
  Logger.log('Outreach is set up. Prospect sheet: ' + ss.getUrl());
}

// ------------------------------------------------------------ hourly ----

function runOutreach() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('outreachSheetId');
  if (!id) return;
  const sh = SpreadsheetApp.openById(id).getSheetByName('Prospects');
  const data = sh.getDataRange().getValues();
  const now = new Date();
  const optedOut = JSON.parse(props.getProperty('outreachOptOut') || '[]');
  const today = Utilities.formatDate(now, CONFIG.timeZone, 'yyyy-MM-dd');
  let sentToday = Number(props.getProperty('outreachSent_' + today) || 0);
  const canSend = out_inWindow_(now);

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const email = String(row[OUT_COL['Email']] || '').trim().toLowerCase();
    const status = String(row[OUT_COL['Status']] || '');
    if (!email || /^(Replied|Opted out|Not interested|Bounced|Closed)/.test(status)) continue;
    const set = (col, val) => { sh.getRange(r + 1, OUT_COL[col] + 1).setValue(val); row[OUT_COL[col]] = val; };
    const touch = (s) => { set('Status', s); set('Last update', now); };

    if (optedOut.includes(email)) { touch('Opted out'); continue; }

    // 1. Replies and bounces always stop the sequence.
    const threadId = String(row[OUT_COL['Thread ID']] || '');
    if (threadId) {
      const thread = GmailApp.getThreadById(threadId);
      const reply = thread && thread.getMessages().find((m) => !m.isDraft() && emailOf_(m.getFrom()).split('@')[1] === email.split('@')[1]);
      if (reply) {
        if (/\b(stop|unsubscribe|remove me|do not contact|don'?t contact)\b/i.test(reply.getPlainBody())) {
          optedOut.push(email); touch('Opted out');
        } else if (/\b(not interested|no thanks|no thank you)\b/i.test(reply.getPlainBody())) {
          touch('Not interested');
        } else {
          getLabel_(LABELS.needsYou).addToThread(thread);
          touch('Replied: answer them from your inbox');
        }
        continue;
      }
      if (GmailApp.search('from:(mailer-daemon OR postmaster) newer_than:14d "' + email + '"', 0, 1).length) {
        touch('Bounced: check the address'); continue;
      }
    }

    // 2. Sends: only approved rows, only in the weekday window, under the daily cap.
    if (String(row[OUT_COL['Approved']]).toUpperCase() !== 'YES' || !canSend || sentToday >= OUT.dailyCap) continue;
    const first = row[OUT_COL['First email sent']];
    const days = first ? (now - new Date(first)) / 86400000 : 0;

    if (!first) {
      const msg = GmailApp.createDraft(email, out_subject_(row), out_intro_(row), { name: 'Minutes Regained' }).send();
      const thread = msg.getThread();
      getLabel_('MR/Outreach').addToThread(thread);
      getLabel_(LABELS.followUpDrafted).addToThread(thread); // keeps the inbox agent from drafting its own follow-up
      set('Thread ID', thread.getId()); set('First email sent', now); touch('Emailed');
      sentToday++;
    } else if (!row[OUT_COL['Follow-up 1 sent']] && days >= OUT.followUpDays[0]) {
      out_followUp_(threadId, email, out_followUp1_(row)); set('Follow-up 1 sent', now); touch('Follow-up 1 sent');
      sentToday++;
    } else if (row[OUT_COL['Follow-up 1 sent']] && !row[OUT_COL['Follow-up 2 sent']] && days >= OUT.followUpDays[1]) {
      out_followUp_(threadId, email, out_followUp2_(row)); set('Follow-up 2 sent', now); touch('Last note sent');
      sentToday++;
    } else if (row[OUT_COL['Follow-up 2 sent']] && days >= OUT.closeAfterDays) {
      touch('Closed: no reply');
    }
  }
  props.setProperties({ outreachOptOut: JSON.stringify(optedOut), ['outreachSent_' + today]: String(sentToday) });
}

// ----------------------------------------------------------- emails -----

function out_greeting_(row) {
  const name = String(row[OUT_COL['Contact name']] || '').trim();
  return 'Hi ' + (name ? name.split(/\s+/)[0] : 'there') + ',';
}

function out_close_() {
  return '\n\n' + [CONFIG.signerName, CONFIG.signature, '', OUT.footer].join('\n');
}

function out_subject_(row) {
  return 'Quick question about ' + row[OUT_COL['Business']];
}

function out_intro_(row) {
  const biz = row[OUT_COL['Business']];
  return [
    out_greeting_(row), '',
    "I'm Jerome with Minutes Regained, a veteran-owned team that sets up automations for Florida service businesses like " + biz +
      ': instant replies to new inquiries, missed-call text-back, quote follow-ups and appointment reminders, all checked daily.', '',
    'In ' + String(row[OUT_COL['Trade']]).toLowerCase() + ', the job usually goes to whoever answers first. I\'d be glad to run a free check of how quickly ' +
      biz + ' responds to a new web inquiry and send you the results. No cost and no obligation.', '',
    "Here's a short look at how it works: " + OUT.demoUrl, '',
    'Would that be useful?',
  ].join('\n') + out_close_();
}

function out_followUp1_(row) {
  return [
    out_greeting_(row), '',
    'Following up on my note about a free response-time check for ' + row[OUT_COL['Business']] +
      ". It takes us about a day, and you'd get a one-page summary of what we found.", '',
    'Want me to run it?',
  ].join('\n') + out_close_();
}

function out_followUp2_(row) {
  return [
    out_greeting_(row), '',
    "Last note from me. If faster replies to new customers aren't a priority right now, no problem. " +
      'If that changes, you can book a 30-minute call any time: ' + OUT.bookingUrl,
  ].join('\n') + out_close_();
}

// Reply inside the original thread; never address a follow-up to ourselves.
function out_followUp_(threadId, email, body) {
  const thread = GmailApp.getThreadById(threadId);
  const msgs = thread.getMessages().filter((m) => !m.isDraft());
  const last = msgs[msgs.length - 1];
  let draft = last.createDraftReplyAll(body);
  if (!draft.getMessage().getTo().toLowerCase().includes(email)) {
    draft.deleteDraft();
    draft = GmailApp.createDraft(email, 'Re: ' + last.getSubject(), body, { name: 'Minutes Regained' });
  }
  draft.send();
}

function out_inWindow_(d) {
  const day = Number(Utilities.formatDate(d, CONFIG.timeZone, 'u')); // 1 = Monday ... 7 = Sunday
  const hour = Number(Utilities.formatDate(d, CONFIG.timeZone, 'H'));
  return day <= 5 && hour >= OUT.sendHours[0] && hour < OUT.sendHours[1];
}
