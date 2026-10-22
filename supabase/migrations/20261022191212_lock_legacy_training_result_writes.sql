-- Independent portion of the authorized TrenerSale security rollout.
-- Only unused legacy result tables; the active training pipeline is unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';

CREATE TABLE saletrening_private.legacy_score_acl_backup_20261022 (
  restore_sql text NOT NULL
);
ALTER TABLE saletrening_private.legacy_score_acl_backup_20261022 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON saletrening_private.legacy_score_acl_backup_20261022 FROM PUBLIC, anon, authenticated;

DO $lock$
DECLARE
  target text;
  entry record;
  columns_sql text;
  client_role text;
BEGIN
  FOREACH target IN ARRAY ARRAY['training_results','realtime_training_sessions','realtime_training_feedback'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      WHERE c.oid = ('public.' || target)::regclass AND c.relrowsecurity
    ) THEN RAISE EXCEPTION 'RLS prerequisite failed: %', target; END IF;
    IF NOT has_table_privilege('service_role', 'public.' || target, 'INSERT')
      OR NOT has_table_privilege('service_role', 'public.' || target, 'UPDATE') THEN
      RAISE EXCEPTION 'Server writer prerequisite failed: %', target;
    END IF;
    FOR entry IN
      SELECT a.privilege_type, a.is_grantable,
        CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS grantee_sql
      FROM pg_catalog.pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid = ('public.' || target)::regclass
        AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
        AND a.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE')
    LOOP
      INSERT INTO saletrening_private.legacy_score_acl_backup_20261022
      VALUES (format('GRANT %s ON TABLE public.%I TO %s%s', entry.privilege_type, target, entry.grantee_sql,
        CASE WHEN entry.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END));
    END LOOP;
    FOR entry IN
      SELECT a.privilege_type, a.is_grantable, att.attname,
        CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS grantee_sql
      FROM pg_catalog.pg_attribute att CROSS JOIN LATERAL aclexplode(att.attacl) a
      WHERE att.attrelid = ('public.' || target)::regclass AND att.attnum > 0 AND NOT att.attisdropped
        AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
        AND a.privilege_type IN ('INSERT','UPDATE')
    LOOP
      INSERT INTO saletrening_private.legacy_score_acl_backup_20261022
      VALUES (format('GRANT %s (%I) ON TABLE public.%I TO %s%s', entry.privilege_type, entry.attname, target,
        entry.grantee_sql, CASE WHEN entry.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END));
    END LOOP;
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.%I FROM PUBLIC,anon,authenticated', target);
    SELECT string_agg(quote_ident(attname), ',') INTO columns_sql
      FROM pg_catalog.pg_attribute
      WHERE attrelid = ('public.' || target)::regclass AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE INSERT (%s),UPDATE (%s) ON TABLE public.%I FROM PUBLIC,anon,authenticated',
      columns_sql, columns_sql, target);
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_table_privilege(client_role, 'public.' || target, 'INSERT')
        OR has_table_privilege(client_role, 'public.' || target, 'UPDATE')
        OR has_table_privilege(client_role, 'public.' || target, 'DELETE')
        OR has_table_privilege(client_role, 'public.' || target, 'TRUNCATE')
        OR has_any_column_privilege(client_role, 'public.' || target, 'INSERT')
        OR has_any_column_privilege(client_role, 'public.' || target, 'UPDATE') THEN
        RAISE EXCEPTION 'Client write remains: % %', client_role, target;
      END IF;
    END LOOP;
  END LOOP;
END $lock$;
COMMIT;
