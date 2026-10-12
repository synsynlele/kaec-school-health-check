// Print a reproducible rollback-only SQL test for execution with authorised DB tooling.
import fs from 'node:fs';
const read = (file) => fs.readFileSync(file, 'utf8');
const migration = read('supabase/migrations/20261012070626_school_custodian_school_scope.sql');
function fixture(file) {
  const source = read(file);
  return source.slice(source.indexOf('do $test$'), source.lastIndexOf('rollback;'));
}
process.stdout.write([
  read('scripts/sql/test-khpos-school-custodian-preflight.sql'),
  migration, migration, // Verify reapplication without duplicate charter revisions.
  read('scripts/sql/test-khpos-school-custodian.sql'),
  fixture('scripts/sql/test-khpos-event-wave6.sql'),
  fixture('scripts/sql/test-khpos-assessment-policy-handoffs.sql'),
  "rollback; select 'Custodian migration and regression tests passed; all changes rolled back' as result;",
].join('\n'));
