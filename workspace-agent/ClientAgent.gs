/**
 * Minutes Regained -- Client inbox agent (Google Apps Script)
 *
 * Runs inside ONE client's own Gmail, installed by the owner. It can only
 * see that mailbox. See MULTI_CLIENT_operations in the document set.
 *
 * Every 10 minutes it looks at new customer email, asks minutesregained.com
 * for a draft (using this client's key, profile and budget), and puts the
 * draft in the owner's Drafts folder. Anything it should not draft gets the
 * MR/Needs-You label and shows in the owner-operator's brief.
 *
 * What it never does: send, forward, delete, archive or mark anything read.
 * It reads only mail that arrives after setup.
 *
 * Setup: Project Settings > Script Properties > add CLIENT_AGENT_KEY.
 * Then choose `setup` in the toolbar, click Run, and approve the permissions.
 * To switch it off: Google Account > Security > Third-party connections >
 * remove this project. Or run `stop`.
 */

const AGENT = {
  apiBase: 'https://minutesregained.com/api/agent',
  // Only threads whose subject contains this are touched. Use it for tests in
  // a personal mailbox; leave '' for a real client so every customer email counts.
  onlySubjectsContaining: 'MR TEST',
  maxThreadsPerRun: 10,
  labels: { done: 'MR/Processed', draft: 'MR/Draft-Ready', needsYou: 'MR/Needs-You' },
};

function setup() {
  Object.values(AGENT.labels).forEach(label_);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CLIENT_AGENT_KEY')) throw new Error('Add the CLIENT_AGENT_KEY Script Property first.');
  props.setProperty('installedAtSec', String(Math.floor(Date.now() / 1000)));
  stop();
  ScriptApp.newTrigger('run').timeBased().everyMinutes(10).create();
  const ok = call_('checkin', {});
  Logger.log(ok && ok.ok ? 'Connected. Send yourself an email with "' + AGENT.onlySubjectsContaining + '" in the subject to test.'
    : 'Not connected. Check the CLIENT_AGENT_KEY Script Property.');
}

function stop() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'run').forEach((t) => ScriptApp.deleteTrigger(t));
}

function run() {
  const props = PropertiesService.getScriptProperties();
  const since = Number(props.getProperty('installedAtSec')) || Math.floor(Date.now() / 1000);
  call_('checkin', {});

  let query = 'in:inbox after:' + since + ' -label:' + AGENT.labels.done.replace('/', '-') + ' -in:chats';
  if (AGENT.onlySubjectsContaining) query += ' subject:"' + AGENT.onlySubjectsContaining + '"';
  const me = Session.getActiveUser().getEmail().toLowerCase();

  GmailApp.search(query, 0, AGENT.maxThreadsPerRun).forEach((thread) => {
    const msgs = thread.getMessages().filter((m) => !m.isDraft());
    const last = msgs[msgs.length - 1];
    const from = last.getFrom();
    if (from.toLowerCase().includes(me)) { label_(AGENT.labels.done).addToThread(thread); return; } // owner wrote last
    if (last.getHeader('List-Unsubscribe') || /no-?reply|mailer-daemon/i.test(from)) { label_(AGENT.labels.done).addToThread(thread); return; }

    const out = call_('draft', { from: from, subject: last.getSubject(), body: last.getPlainBody() });
    if (out && out.action === 'draft' && out.draft) {
      last.createDraftReply(out.draft);                 // a draft only; the owner presses Send
      label_(AGENT.labels.draft).addToThread(thread);
    } else if (!out || out.action === 'handoff') {
      label_(AGENT.labels.needsYou).addToThread(thread);
    }
    label_(AGENT.labels.done).addToThread(thread);
  });
}

// One call to minutesregained.com with this client's key. Never throws: a
// failed call leaves the thread for the next run and the owner-operator's
// brief notices the silence.
function call_(path, payload) {
  const key = PropertiesService.getScriptProperties().getProperty('CLIENT_AGENT_KEY');
  if (!key) return null;
  try {
    const res = UrlFetchApp.fetch(AGENT.apiBase + '/' + path, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + key }, payload: JSON.stringify(payload),
    });
    return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : null;
  } catch (e) {
    return null;
  }
}

const agentLabels_ = {};
function label_(name) {
  if (!agentLabels_[name]) agentLabels_[name] = GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
  return agentLabels_[name];
}
