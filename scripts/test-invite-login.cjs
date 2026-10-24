const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
for (const file of ['index.html', 'deploy/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('function authScreen(');
  const end = html.indexOf('}async function signUp()', start) + 1;
  const source = html.slice(start, end);
  for (const stored of [false, true]) {
    for (const buttonIndex of [0, 1]) {
      const root = { innerHTML: '' };
      const email = { value: 'employee@example.test' };
      const storage = new Map(stored ? [['saletrening_invite_token', 'synthetic-invite']] : []);
      const search = stored ? '' : '?invite=synthetic-invite&email=employee%40example.test';
      const ctx = vm.createContext({
        URLSearchParams, location: { search },
        localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
        $: id => id === 'root' ? root : id === 'email' ? email : null,
        esc: s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      });
      vm.runInContext(source, ctx);
      vm.runInContext('authScreen()', ctx);
      assert.ok(root.innerHTML.includes('id="first"'), file + ': invitation opens registration');
      const buttons = [...root.innerHTML.matchAll(/<button\b[^>]*onclick="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)]
        .filter(m => m[1].includes("authScreen('login')"));
      assert.equal(buttons.length, 2, file + ': both existing-account controls select login');
      vm.runInContext(buttons[buttonIndex][1], ctx);
      assert.ok(!root.innerHTML.includes('id="first"'), file + ': login hides registration fields');
      assert.ok(root.innerHTML.includes('onclick="signIn()"'));
      assert.ok(root.innerHTML.includes('autocomplete="current-password"'));
      assert.ok(root.innerHTML.includes('Войдите с email'));
      assert.ok(root.innerHTML.includes('value="employee@example.test"'));
      assert.equal(storage.get('saletrening_invite_token'), 'synthetic-invite');
      assert.equal(ctx.location.search, search, file + ': invitation URL preserved');
      vm.runInContext("authScreen('register')", ctx);
      assert.ok(root.innerHTML.includes('id="first"'));
      storage.clear(); ctx.location.search = '';
      vm.runInContext('authScreen()', ctx);
      assert.ok(!root.innerHTML.includes('id="first"'), file + ': ordinary entry remains login');
    }
  }
}
console.log('PASS: both login controls switch invite registration to login, preserve URL/token/email, allow return to registration; ordinary entry remains login (root and deploy).');
