-- Emergency rollback only: restores previous insecure browser write privileges.
BEGIN;
DO $restore$
DECLARE entry record;
BEGIN
  FOR entry IN SELECT restore_sql FROM saletrening_private.legacy_score_acl_backup_20261022
  LOOP EXECUTE entry.restore_sql; END LOOP;
END $restore$;
-- Keep the ACL backup. No training rows are changed.
COMMIT;
