const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const secret = 'PRIVATE_AUTH_LINK_AND_TOKEN';
const inviteId = '11111111-2222-4333-8444-555555555555';
const edgeSource = stripTypeScriptTypes(fs.readFileSync('supabase/functions/send-company-invitation/index.ts', 'utf8').replace(/^import .*;\s*$/gm, ''));

async function backend(body, options = {}) {
  let handler, generated = 0, mailed = 0;
  const invitation = { id: inviteId, company_id: 'company', email: 'employee@example.com', role: 'employee', token: secret, expires_at: new Date(Date.now() + 86400000).toISOString(), accepted_at: null };
  const row = table => table === 'profiles' ? { company_id: 'company', role: options.role || 'director' } : table === 'companies' ? { name: 'Test company' } : invitation;
  const client = {
    auth: { getUser: async () => ({ data: { user: options.unauthorized ? null : { id: 'manager' } } }), admin: { generateLink: async () => { generated++; return { data: { properties: { action_link: 'https://auth.example.com/' + secret } } }; } } },
    from(table) {
      const filters = [];
      const query = {
        select() { return this; }, insert(values) { Object.assign(invitation, values); return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        async single() { return { data: row(table) }; },
        async maybeSingle() { return { data: filters.every(([key, value]) => row(table)[key] === value) ? row(table) : null }; }
      };
      return query;
    }
  };
  vm.runInNewContext(edgeSource, {
    Deno: { env: { get: name => name === 'RESEND_API_KEY' && options.noEmailKey ? undefined : 'test-value' }, serve: callback => { handler = callback; } },
    createClient: () => client, Response, crypto: { randomUUID: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' },
    fetch: async (url, request) => {
      mailed++;
      const payload = JSON.parse(request.body);
      assert.deepEqual(payload.to, ['employee@example.com']);
      assert.ok(payload.html.includes(secret));
      return new Response(JSON.stringify({ id: 'email-id', message: secret }), { status: options.emailFailure ? 500 : 200 });
    }, console
  });
  const result = await handler(new Request('https://function.example.com', { method: 'POST', headers: { Authorization: 'Bearer test-user', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  const text = await result.text();
  assert.ok(!text.includes(secret), 'Response leaked authentication material');
  const data = JSON.parse(text);
  for (const key of ['token', 'invite_url', 'action_link', 'redirect_to']) assert.ok(!(key in data), `Response leaked ${key}`);
  return { data, status: result.status, generated, mailed };
}

async function frontend() {
  const elements = new Map();
  const node = id => elements.get(id) || (elements.set(id, { value: '', innerHTML: '', textContent: '', disabled: false, setAttribute() {} }), elements.get(id));
  node('inviteEmail').value = 'employee@example.com'; node('inviteRole').value = 'employee';
  const calls = []; let failing = false; let release;
  const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'test-user' } } }) }, functions: { invoke: async (_, { body }) => {
    calls.push(body);
    if (body.mode === 'send' && release) await new Promise(resolve => { release.resolve = resolve; });
    if (body.mode === 'send' && failing) return { error: new Error(secret) };
    return { data: { ok: true, invitation_id: inviteId, invite_url: secret, token: secret } };
  } } };
  const context = { sb: client, window: { toast() {} }, document: { getElementById: node, querySelector: () => node('createButton') } };
  vm.runInNewContext(fs.readFileSync('company-invitations.js', 'utf8'), context);
  await context.window.createCompanyInvitation();
  assert.ok(node('inviteResult').innerHTML.includes('Приглашение подготовлено'));
  assert.ok(!node('inviteResult').innerHTML.includes(secret));
  failing = true;
  await context.window.sendCompanyInvitation();
  assert.ok(node('inviteResult').innerHTML.includes('Повторить отправку'));
  assert.ok(!node('inviteResult').innerHTML.includes(secret));
  failing = false; release = {};
  const sending = context.window.sendCompanyInvitation();
  await new Promise(resolve => setImmediate(resolve));
  await context.window.sendCompanyInvitation();
  release.resolve(); await sending;
  assert.equal(calls.filter(call => call.mode === 'send').length, 2, 'Duplicate click sent another request');
  assert.ok(node('inviteResult').innerHTML.includes('Приглашение отправлено'));
  assert.ok(!node('inviteResult').innerHTML.includes(secret));
  for (const call of calls) assert.ok(!('token' in call) && !('invite_url' in call));
  assert.equal(node('createButton').disabled, false);
}

(async () => {
  const create = await backend({ mode: 'create', email: 'employee@example.com', role: 'employee' });
  assert.equal(create.data.invitation_id, inviteId); assert.equal(create.generated, 0); assert.equal(create.mailed, 0);
  const sendBody = { mode: 'send', email: 'employee@example.com', invitation_id: inviteId };
  const send = await backend(sendBody); assert.equal(send.status, 200); assert.equal(send.generated, 1); assert.equal(send.mailed, 1);
  assert.equal((await backend(sendBody, { unauthorized: true })).status, 401);
  assert.equal((await backend(sendBody, { role: 'employee' })).status, 403);
  const other = await backend({ ...sendBody, invitation_id: '99999999-2222-4333-8444-555555555555' }); assert.equal(other.status, 404); assert.equal(other.generated, 0);
  const mismatch = await backend({ ...sendBody, email: 'other@example.com' }); assert.equal(mismatch.status, 400); assert.equal(mismatch.generated, 0);
  assert.equal((await backend(sendBody, { emailFailure: true })).status, 502);
  const unconfigured = await backend(sendBody, { noEmailKey: true }); assert.equal(unconfigured.status, 503); assert.equal(unconfigured.generated, 0);
  await frontend();
  assert.equal(fs.readFileSync('company-invitations.js', 'utf8'), fs.readFileSync('deploy/company-invitations.js', 'utf8'));
  for (const path of ['index.html', 'deploy/index.html']) {
    const text = fs.readFileSync(path, 'utf8');
    assert.ok(text.includes('/company-invitations.js?v=20261016-private'));
    assert.ok(!text.includes('id="inviteLink"') && !text.includes('pendingCompanyInvitation'));
  }
  console.log('PASS: invitation privacy, recipient-only email, permission boundaries, retry, duplicate clicks, deployed assets');
})().catch(error => { console.error(error); process.exitCode = 1; });
