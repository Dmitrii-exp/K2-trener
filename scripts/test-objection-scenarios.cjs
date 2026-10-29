// Run with PGLITE_MODULE=/path/to/@electric-sql/pglite node scripts/test-objection-scenarios.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/objection-training-scenarios.sql'), 'utf8');
const expected = ['Дорого', 'Нет бюджета', 'Закупки закончились', 'У нас есть поставщик',
  'Ничего не нужно', 'Был негативный опыт работы с вами', 'Решает Москва / директор',
  'Слышал негативные отзывы', 'Долгая поставка товара'];

async function fixture(identity = false) {
  const db = new PGlite();
  await db.exec(`create table public.saletrening_scenarios (
    id bigint ${identity ? 'generated always as identity' : ''} primary key,
    active boolean not null default true, created_at timestamptz not null default now(),
    evaluation_criteria jsonb not null default '{}', updated_at timestamptz not null default now(),
    title text not null, description text, difficulty text not null default 'Средняя',
    client_role text, industry text, objective text, objections text[] not null default '{}',
    client_mood text default 'Нейтральный', goal text, required_questions text[] not null default '{}',
    success_actions text[] not null default '{}', failure_actions text[] not null default '{}', system_prompt text
  );
  create table saved_sessions (id bigint primary key, scenario_id bigint references public.saletrening_scenarios(id));
  insert into public.saletrening_scenarios (id,title,description) overriding system value
    values (100,'Существующая тренировка','Не менять');
  insert into saved_sessions values (1,100);`);
  return db;
}

(async () => {
  for (const identity of [false, true]) {
    const db = await fixture(identity);
    try {
      const before = (await db.query('select * from saletrening_scenarios where id=100')).rows;
      await db.exec(sql);
      let rows = (await db.query('select * from saletrening_scenarios order by id')).rows;
      assert.equal(rows.length, 10);
      assert.deepEqual(rows.slice(1).map(s => s.title), expected);
      for (const s of rows.slice(1)) {
        assert.equal(s.active, true);
        assert.equal(s.difficulty, 'Средняя');
        assert.deepEqual(s.objections, [s.title]);
        assert.ok(s.description.length > 200 && s.description.length < 1800);
        assert.ok(s.objective && s.system_prompt);
        assert.equal(s.required_questions.length, 3);
        assert.equal(s.success_actions.length, 3);
        assert.equal(s.failure_actions.length, 3);
      }
      await db.exec(sql);
      assert.deepEqual((await db.query('select * from saletrening_scenarios order by id')).rows, rows);
      assert.deepEqual((await db.query('select * from saletrening_scenarios where id=100')).rows, before);
      assert.equal((await db.query('select scenario_id from saved_sessions')).rows[0].scenario_id, 100);
      // The existing renderer and AI payload consume these fields without frontend changes.
      const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
      const source = html.slice(html.indexOf('function trainingModeOf('), html.indexOf('function setTrainingFilter('));
      const state = { scenarios: rows.slice(1) };
      const trainingFilters = { query: '', difficulty: 'all', mode: 'all' };
      const catalog = new Function('state', 'trainingFilters', source + '; return {trainingFilteredScenarios,trainingModeOf};')(state, trainingFilters);
      assert.equal(catalog.trainingFilteredScenarios().length, 9);
      trainingFilters.query = 'бюджета';
      assert.deepEqual(catalog.trainingFilteredScenarios().map(s => s.title), ['Нет бюджета']);
      trainingFilters.query = '';
      trainingFilters.mode = 'dialog';
      assert.equal(catalog.trainingFilteredScenarios().length, 9);
      if (identity) {
        await db.exec("insert into saletrening_scenarios(title) values ('Следующая тренировка')");
        assert.equal((await db.query("select id from saletrening_scenarios where title='Следующая тренировка'")).rows[0].id, 110);
      }
      console.log(`PASS: ${identity ? 'identity' : 'manual'} ids; nine scenarios, retry, old rows/history, catalog/search`);
    } finally { await db.close(); }
  }
  const db = await fixture();
  try {
    await db.exec("insert into saletrening_scenarios(id,title,description) values (200,' Дорого ','Авторский сценарий')");
    const before = (await db.query('select * from saletrening_scenarios where id=200')).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from saletrening_scenarios where id=200')).rows, before);
    assert.equal((await db.query('select count(*)::int as n from saletrening_scenarios')).rows[0].n, 10);
    console.log('PASS: existing matching title is reused without overwriting content');
  } finally { await db.close(); }
  const inactive = await fixture();
  try {
    await inactive.exec("insert into saletrening_scenarios(id,title,active) values (200,'Дорого',false)");
    await assert.rejects(inactive.exec(sql), /Не все 9 сценариев активны/);
    await inactive.exec('rollback');
    assert.equal((await inactive.query('select count(*)::int as n from saletrening_scenarios')).rows[0].n, 2);
    console.log('PASS: inactive title conflict rolls back all inserts');
  } finally { await inactive.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
