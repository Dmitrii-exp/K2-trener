// Isolated PostgreSQL-compatible engine only. Never connects to Supabase.
// Install @electric-sql/pglite@0.3.14 in a temporary prefix; see deployment docs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.companies(id uuid primary key);
      create table public.profiles(id uuid primary key, company_id uuid, role text);
      create table public.company_invitations(id uuid primary key,company_id uuid,email text,accepted_at timestamptz,expires_at timestamptz);
      insert into companies values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
      insert into profiles values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','director');
      insert into company_invitations values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','recipient@example.invalid',null,now()+interval '1 day'),
      ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','recipient@example.invalid',null,now()+interval '1 day');`);
    const sql = fs.readFileSync('supabase/invitation-send-limits.sql', 'utf8');
    await db.exec(sql); await db.exec(sql); // repeat application must be safe
    const user = '00000000-0000-4000-8000-000000000003';
    const company = '00000000-0000-4000-8000-000000000001';
    const invite = '00000000-0000-4000-8000-000000000004';
    const email = 'recipient@example.invalid';
    async function reserve(u=user,c=company,i=invite,e=email) {
      return (await db.query('select public.reserve_saletrening_invitation_send($1,$2,$3,$4) as value',[u,c,i,e])).rows[0].value;
    }
    assert.equal((await reserve(user,'00000000-0000-4000-8000-000000000002')).allowed,false);
    assert.equal((await reserve(user,company,invite,'other@example.invalid')).allowed,false);
    const first = await reserve(); assert.equal(first.allowed,true);
    const denied = await reserve(); assert.equal(denied.status,429); assert.ok(denied.retry_after >= 119);
    await db.query('select public.finish_saletrening_invitation_send($1)',[first.attempt_id]);
    assert.equal((await reserve()).status,429);
    assert.equal((await reserve(user,company,'00000000-0000-4000-8000-000000000005')).status,429);
    await db.exec("update saletrening_private.invitation_send_attempts set reserved_at=clock_timestamp()-interval '61 seconds'");
    assert.equal((await reserve()).allowed,true);
    // Pending reservation survives a worker crash, then expires automatically.
    await db.exec("update saletrening_private.invitation_send_attempts set reserved_at=clock_timestamp()-interval '121 seconds'");
    assert.equal((await reserve()).allowed,true);
    await db.exec(`delete from saletrening_private.invitation_send_attempts;
      insert into saletrening_private.invitation_send_attempts(company_id,recipient,reserved_at,finished_at)
      select '${company}','old-'||n||'@example.invalid',clock_timestamp()-interval '5 minutes',clock_timestamp()
      from generate_series(1,29) n;`);
    assert.equal((await reserve()).allowed,true); // 30th attempt
    await db.exec("update company_invitations set email='next@example.invalid'");
    assert.equal((await reserve(user,company,invite,'next@example.invalid')).status,429); // 31st
    await db.exec("update saletrening_private.invitation_send_attempts set reserved_at=clock_timestamp()-interval '61 minutes'");
    assert.equal((await reserve(user,company,invite,'next@example.invalid')).allowed,true);
    await db.exec("update profiles set role='employee'");
    assert.equal((await reserve(user,company,invite,'next@example.invalid')).allowed,false);
    const perms = await db.query(`select
      has_function_privilege('anon','public.reserve_saletrening_invitation_send(uuid,uuid,uuid,text)','execute') as anon,
      has_function_privilege('authenticated','public.reserve_saletrening_invitation_send(uuid,uuid,uuid,text)','execute') as member,
      has_function_privilege('service_role','public.reserve_saletrening_invitation_send(uuid,uuid,uuid,text)','execute') as server,
      has_function_privilege('authenticated','public.finish_saletrening_invitation_send(uuid)','execute') as finish,
      has_table_privilege('authenticated','saletrening_private.invitation_send_attempts','select') as table_access,
      (select bool_and(relrowsecurity) from pg_class where oid in ('saletrening_private.invitation_send_attempts'::regclass,'saletrening_private.invitation_send_locks'::regclass)) as rls`);
    assert.deepEqual(perms.rows[0],{anon:false,member:false,server:true,finish:false,table_access:false,rls:true});
    console.log('PASS: real SQL, repeat install, company/role/recipient isolation, cooldown across invite IDs, crash recovery, rolling 30/hour cap, client-denied permissions and RLS');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
