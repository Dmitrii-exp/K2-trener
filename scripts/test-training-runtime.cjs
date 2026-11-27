// Regression checks: no real network, credentials, or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = new Map();
const element = () => ({ innerHTML: '', textContent: '', value: 'Ответ менеджера',
  classList: { add() {}, remove() {} }, focus() {}, addEventListener() {}, remove() {},
  querySelector() { return element(); } });
let inserts = 0, saves = 0;
let failSave = true;
const calls = [];
const replies = [];
const timers = new Set();
const context = {
  console: { log() {}, error() {} },
  setTimeout(fn, ms) { const id = setTimeout(fn, ms); timers.add(id); return id; },
  clearTimeout(id) { clearTimeout(id); timers.delete(id); },
  document: { readyState: 'complete', getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element, head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
  state: { scenarios: [{ id: 1 }], user: { id: 'employee' }, profile: { company_id: 'company' } },
  SUPABASE_URL: 'https://example.test', SUPABASE_KEY: 'public',
  sb: {
    auth: { async getSession() { return { data: { session: { access_token: 'test' } } }; } },
    from() {
      return {
        insert() { inserts++; return { select() { return { single: async () => ({ data: { id: 'session' } }) }; } }; },
        update({transcript}) {
          assert.equal(transcript[0].speaker, 'manager');
          calls.push('persist');
          return { eq() { return this; }, select() { return this; }, async single() {
            return failSave ? { error: new Error('Simulated outage') } : { data: { id: 'session' } };
          } };
        }
      };
    }
  },
  async fetch() {
    calls.push('evaluate');
    return { ok: true, async json() { return { ok: true, evaluation: { overall_score: 75 } }; } };
  },
  async loadAll() { calls.push('statistics'); },
  render() {}, toast() {},
  aiClientReply(message, opening) {
    assert.ok(message);
    assert.equal(opening, false);
    return new Promise((resolve, reject) => replies.push({ resolve, reject })); },
  async saveSession() { saves++; },
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../training-ui-v7.js'), 'utf8'), context);
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
vm.runInContext(html.slice(html.indexOf('function hasTrainingConversation('), html.indexOf('function voiceInput(')), context);
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  try {
    const first = context.__launchTextTrainingV7(1);
    await context.__launchTextTrainingV7(1);
    await first;
    assert.equal(inserts, 1, 'double click must not create two sessions');
    assert.equal(context.state.messages.length, 0, 'the trainee opens the dialogue');
    assert.equal(replies.length, 0, 'no AI request before the first manager turn');

    const turn = nodes.get('st-text-send').onclick(); await tick();
    assert.equal(saves, 1, 'manager turn must save before the AI request finishes');
    await nodes.get('st-text-send').onclick();
    assert.equal(replies.length, 1, 'second send must be blocked during AI reply');
    replies.shift().reject(new Error('Simulated AI outage')); await turn;
    assert.equal(context.state.messages.length, 1, 'manager turn survives AI failure');

    const retry = nodes.get('st-text-send').onclick(); await tick();
    replies.shift().resolve('Продолжим'); await retry;
    assert.equal(context.state.messages.at(-1).content, 'Продолжим');

    await nodes.get('st-text-finish').onclick();
    assert.deepEqual(calls, ['persist']);
    assert.ok(context.state.session, 'retain the dialogue after a failed save');
    failSave = false;
    await nodes.get('st-text-finish').onclick();
    assert.deepEqual(calls, ['persist', 'persist', 'evaluate', 'statistics']);
    assert.equal(context.state.session, null);
    console.log('PASS: manager opens, duplicate launch and send blocked, dialogue retained on failures, confirmed save before evaluation and statistics');
  } finally { for (const timer of timers) clearTimeout(timer); }
})().catch(error => { console.error(error); process.exitCode = 1; });
