// Reset only the dedicated pre-created test database; serial tests need no CREATEDB.
import postgres from 'postgres';
import { spawnSync } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL || 'postgres://unset/unset');
if (url.hostname !== '127.0.0.1' || url.port !== '43184' || url.pathname !== '/ainews_dev_test') throw new Error('Only the dedicated loopback ainews_dev_test database is allowed');
const files = process.argv.slice(2);
if (!files.length || files.some(f => !/^tests\/(?:backend\/)?[\w-]+\.test\.ts$/.test(f))) throw new Error('Pass explicit test files');
let failed = false;
for (const file of files) {
  const db = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    const [r] = await db`SELECT current_database() AS db, rolcreatedb FROM pg_roles WHERE rolname=current_user`;
    if (r.db !== 'ainews_dev_test') throw new Error('Database identity mismatch');
    console.log(JSON.stringify({ file, database: r.db, roleCreatedb: r.rolcreatedb, reset: 'public and pgboss schemas; dedicated test DB only' }));
    await db.unsafe('DROP SCHEMA IF EXISTS pgboss CASCADE');
    await db.unsafe('DROP SCHEMA public CASCADE');
    await db.unsafe('CREATE SCHEMA public');
  } finally { await db.end(); }
  const migrate = spawnSync(process.execPath, ['scripts/migrate.ts'], { stdio: 'inherit', timeout: 120000 });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
  const env = { ...process.env, MODEL_CALLS_ENABLED: 'true', COLLECT_ENABLED: 'true' };
  // Every enabled-model test below points providers at local stubs; backend/api forces valves off itself.
  const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=120000', file], { env, stdio: 'inherit', timeout: 240000 });
  console.log(JSON.stringify({ file, exit: run.status, signal: run.signal }));
  if (run.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
