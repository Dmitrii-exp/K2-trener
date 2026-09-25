// Regression checks: no real network, credentials, or database writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = new Map();
const element = () => ({ innerHTML: '', textContent: '', value: 'Ответ менеджера',
  classList: { add() {}, remove() {} }, focus() {}, addEventListener() {}, remove() {},
  querySelector() { return element(); } });
let inserts = 0, saves = 0;
const replies = [];
const timers = new Set();
const context = {
  console: { log() {}, error() {} },
  setTimeout(fn, ms) { const id = setTimeout(fn, ms); timers.add(id); return id; },
  clearTimeout(id) { clearTimeout(id); timers.delete(id); },
  document: { readyState: 'complete', getElementById(id) { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); },
    createElement: element, head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
  state: { scenarios: [{ id: 1 }], user: { id: 'employee' }, profile: { company_id: 'company' } },
  sb: { from() { return { insert() { inserts++; return { select() { return { single: async () => ({ data: { id: 'session' } }) }; } }; } }; } },
  aiClientReply() { return new Promise((resolve, reject) => replies.push({ resolve, reject })); },
  async saveSession() { saves++; },
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../training-ui-v7.js'), 'utf8'), context);
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  try {
    const first = context.__launchTextTrainingV7(1);
    await context.__launchTextTrainingV7(1);
    await tick();
    assert.equal(inserts, 1, 'double click must not create two sessions');
    await nodes.get('st-text-send').onclick();
    assert.equal(context.state.messages.length, 0, 'send must remain blocked during opening reply');
    assert.equal(replies.length, 1);
    replies.shift().resolve('Здравствуйте'); await first;
    assert.equal(context.state.messages.length, 1);
    const turn = nodes.get('st-text-send').onclick(); await tick();
    assert.equal(saves, 2, 'manager turn must save before the AI request finishes');
    await nodes.get('st-text-send').onclick();
    assert.equal(replies.length, 1, 'second send must be blocked during AI reply');
    replies.shift().reject(new Error('Simulated AI outage')); await turn;
    assert.equal(context.state.messages.length, 2, 'manager turn survives AI failure');
    const retry = nodes.get('st-text-send').onclick(); await tick();
    replies.shift().resolve('Продолжим'); await retry;
    assert.equal(context.state.messages.at(-1).content, 'Продолжим');
    console.log('PASS: duplicate launch, opening lock, send lock, save before AI, recovery after AI failure');
  } finally { for (const timer of timers) clearTimeout(timer); }
})().catch(error => { console.error(error); process.exitCode = 1; });
