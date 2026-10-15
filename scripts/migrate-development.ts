import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { validateDevelopmentDbConfig } from '../apps/server/storage/development-config.ts';

const configFile = process.env.ANVIL_DB_CONFIG;
if (!configFile) throw Error('PROTECTED_DB_CONFIG_REQUIRED');
const config = validateDevelopmentDbConfig(JSON.parse(await readFile(configFile, 'utf8')), 'migrator');
const client = new Client(config);
const sql = await readFile(new URL('../db/migrations/0000_environment.sql', import.meta.url), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
try {
  await client.connect();
  const identity = (await client.query('SELECT current_database() AS database,current_user AS username,inet_server_port() AS port')).rows[0];
  if (identity.database !== config.database || identity.username !== config.user || identity.port !== 5432) throw Error('CONNECTED_DB_TARGET_INVALID');
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('anvil-v3-migrations'))");
  const existing = await client.query("SELECT to_regclass('anvil.schema_migrations') IS NOT NULL AS present");
  if (!existing.rows[0].present) {
    await client.query(sql);
    await client.query('INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)', ['0000_environment', checksum]);
  } else {
    const applied = await client.query('SELECT checksum FROM anvil.schema_migrations WHERE id=$1', ['0000_environment']);
    if (applied.rows[0]?.checksum !== checksum) throw Error('MIGRATION_CHECKSUM_CONFLICT');
  }
  const fixtures = JSON.parse(await readFile(new URL('../db/qa/fixtures.json', import.meta.url), 'utf8'));
  for (const [name, value] of Object.entries(fixtures)) {
    await client.query('INSERT INTO anvil_qa.fixtures(name,payload) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET payload=EXCLUDED.payload', [name, JSON.stringify(value)]);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ migration: '0000_environment', checksum, fixtures: Object.keys(fixtures).length, realProductUsersCreated: 0, status: 'applied-and-seeded' }));
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('DEVELOPMENT_MIGRATION_FAILED_NO_SECRET_OUTPUT');
  process.exitCode = 1;
} finally { await client.end(); }
