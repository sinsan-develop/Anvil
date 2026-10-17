import { readFile, realpath, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { canonicalJson, contentHash } from '../contracts/canonical.ts';
import { validateDevelopmentDbConfig } from '../apps/server/storage/development-config.ts';
import { assignmentDraftMigrationId } from './assignment-draft-sql-qa.ts';
import { readAssignmentDevelopmentBinding, assignmentDevelopmentManifest, assertAssignmentDevelopmentManifest, assertAssignmentDevelopmentBefore, assertAssignmentDevelopmentBaseline, assignmentDevelopmentTables } from './assignment-draft-development-guard.ts';
import { sourceReadDevelopmentFailureDisposition as disposition, sourceReadDevelopmentStep as step, type SourceReadTableState } from './source-read-development-guard.ts';

let db: Client | null = null, post: Client | null = null, committed = false, commitAttempted = false, connected = false, phase = 'PREFLIGHT', expiry = NaN;
let result: Record<string, unknown> = {};
const env = process.env, git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const q = (client: Client, sql: string, values?: unknown[]) => step(() => client.query(sql, values), expiry);
async function configure(client: Client) {
  const identity = (await q(client, 'SELECT current_database() db,current_user role,inet_server_port() port,current_setting(\'server_version_num\')::int version')).rows[0];
  if (identity?.db !== 'anvil_v3_development' || identity.role !== 'anvil_v3_migrator' || identity.port !== 5432 || identity.version < 150000 || identity.version >= 160000) throw Error('FN09_DEVELOPMENT_IDENTITY_INVALID');
  await q(client, "SET TIME ZONE 'UTC';SET statement_timeout='30s';SET lock_timeout='5s';SET idle_in_transaction_session_timeout='60s'");
}
async function states(client: Client): Promise<SourceReadTableState[]> {
  const tables = (await q(client, "SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('anvil','anvil_qa') AND c.relkind='r' ORDER BY n.nspname,c.relname")).rows, output: SourceReadTableState[] = [];
  for (const table of tables) {
    if (!['anvil', 'anvil_qa'].includes(table.schema) || !/^[a-z0-9_]+$/.test(table.name)) throw Error('FN09_DEVELOPMENT_BASELINE_INVALID');
    const target = '"' + table.schema + '"."' + table.name + '"';
    // 신규 migration 행만 fingerprint에서 제외한다. count/전체47 checksum은 별도 검사하며 기존46행 timestamp도 보존한다.
    const filter = table.schema === 'anvil' && table.name === 'schema_migrations' ? " FILTER (WHERE row.id<>'0012_assignment_drafts')" : '';
    const data = (await q(client, `SELECT count(*)::text n,md5(COALESCE(string_agg(to_jsonb(row)::text,E'\\n' ORDER BY to_jsonb(row)::text)${filter},'')) fingerprint FROM ${target} row`)).rows[0];
    const structure = (await q(client, `SELECT c.relacl::text acl,
      (SELECT jsonb_agg(jsonb_build_object('n',a.attname,'t',format_type(a.atttypid,a.atttypmod),'required',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) columns,
      (SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid) constraints,
      (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=c.oid) indexes,
      (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) triggers
      FROM pg_class c WHERE c.oid=$1::regclass`, [target])).rows[0];
    output.push({ ...table, n: String(data.n), fingerprint: data.fingerprint, structureHash: contentHash(canonicalJson(structure)) });
  }
  return output;
}
try {
  const args = process.argv.slice(2); if (args.length !== 1 || !['--plan', '--apply-schema-only'].includes(args[0]!)) throw Error('FN09_DEVELOPMENT_MODE_REQUIRED');
  if (args[0] === '--plan') result = { mode: 'FN09_SCHEMA_ONLY', database: 'anvil_v3_development', migration: assignmentDraftMigrationId, oldMigrations: 46, appliedMigrations: 47, newTables: assignmentDevelopmentTables, databaseAccess: 0, secretReads: 0, seeded: 0, usersCreated: 0, serviceChanges: 0, rollback: 'TRANSACTION_BEFORE_COMMIT_FORWARD_REPAIR_AFTER_COMMIT' };
  else {
    // marker는 승인 발급이 아니다. 실행자가 별도 결정·exact SHA/SQL/창과 대조해야 한다.
    const partial = { platform: process.platform, uid: process.getuid?.(), cwd: process.cwd(), head: env.ANVIL_FN09_APPLY_COMMIT ?? '', origin: 'git@github-sinsan-develop:sinsan-develop/Anvil.git', dirty: '', configPath: env.ANVIL_DB_CONFIG ?? '', approval: env.ANVIL_FN09_APPLY_APPROVAL ?? '', commit: env.ANVIL_FN09_APPLY_COMMIT ?? '', sqlHash: env.ANVIL_FN09_APPROVED_SQL_SHA256 ?? '', expiresAt: env.ANVIL_FN09_APPLY_EXPIRES_AT ?? '' };
    readAssignmentDevelopmentBinding(partial, Date.now());
    const binding = readAssignmentDevelopmentBinding({ ...partial, cwd: await realpath(process.cwd()), head: git(['rev-parse', 'HEAD']), origin: git(['remote', 'get-url', 'origin']), dirty: git(['status', '--porcelain']) }, Date.now()); expiry = binding.expiresAtMs;
    if (await realpath(new URL(import.meta.url)) !== partial.cwd + '/scripts/apply-assignment-draft-development.ts') throw Error('FN09_DEVELOPMENT_ROOT_INVALID');
    const manifest = await assignmentDevelopmentManifest(); if (manifest.checksum !== binding.sqlHash) throw Error('FN09_DEVELOPMENT_HASH_INVALID');
    const file = await lstat(partial.configPath); if (!file.isFile() || file.isSymbolicLink() || file.uid !== 1000 || (file.mode & 0o077) !== 0 || await realpath(partial.configPath) !== partial.configPath) throw Error('FN09_DEVELOPMENT_CONFIG_INVALID');
    const config = validateDevelopmentDbConfig(JSON.parse(await step(() => readFile(partial.configPath, 'utf8'), expiry, 5000)), 'migrator');
    phase = 'CONNECT'; db = new Client(config); await step(() => db!.connect(), expiry, 5000); connected = true; await configure(db);
    phase = 'BASELINE'; await q(db, 'BEGIN ISOLATION LEVEL REPEATABLE READ'); await q(db, "SELECT pg_advisory_xact_lock(hashtext('anvil-v3-migrations'))");
    assertAssignmentDevelopmentManifest((await q(db, 'SELECT id,checksum FROM anvil.schema_migrations')).rows, manifest, 'BEFORE'); const before = await states(db); assertAssignmentDevelopmentBefore(before);
    if (before.some(r => r.schema === 'anvil' && assignmentDevelopmentTables.includes(r.name))) throw Error('FN09_DEVELOPMENT_ALREADY_APPLIED');
    phase = 'APPLY_NEW_SCHEMA'; await q(db, manifest.sql); await q(db, 'INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)', [assignmentDraftMigrationId, manifest.checksum]);
    phase = 'VERIFY_IN_TRANSACTION'; assertAssignmentDevelopmentBaseline(before, await states(db)); assertAssignmentDevelopmentManifest((await q(db, 'SELECT id,checksum FROM anvil.schema_migrations')).rows, manifest, 'AFTER');
    phase = 'COMMIT_SCHEMA'; if (Date.now() >= expiry) throw Error('FN09_DEVELOPMENT_EXPIRED'); commitAttempted = true; await q(db, 'COMMIT'); committed = true;
    phase = 'VERIFY_AFTER_COMMIT'; post = new Client(config); await step(() => post!.connect(), expiry, 5000); await configure(post); await q(post, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assertAssignmentDevelopmentBaseline(before, await states(post)); assertAssignmentDevelopmentManifest((await q(post, 'SELECT id,checksum FROM anvil.schema_migrations')).rows, manifest, 'AFTER'); await q(post, 'COMMIT');
    result = { status: 'PASS', commit: binding.commit, migration: { id: assignmentDraftMigrationId, checksum: manifest.checksum }, oldMigrations: 46, appliedMigrations: 47, existingTables: before.length, legacyBaselineHash: contentHash(canonicalJson(before)), newTables: assignmentDevelopmentTables, newTableRows: 0, seeded: 0, usersCreated: 0, serviceChanges: 0, actualAgentCalls: 0, actualWorkflowVerified: false };
  }
} catch (error) {
  const outcome = disposition(committed, commitAttempted); let rollbackConfirmed = false;
  if (db && outcome.action === 'ROLLBACK_TRANSACTION') try { await q(db, 'ROLLBACK'); rollbackConfirmed = true; } catch { /* 실제 rollback 미확인이면 false 유지 */ }
  const e = error as { message?: unknown; code?: unknown; position?: unknown }, allowed = /^(FN09_DEVELOPMENT_(MODE_REQUIRED|BINDING_INVALID|ROOT_INVALID|HASH_INVALID|CONFIG_INVALID|IDENTITY_INVALID|BASELINE_INVALID|MANIFEST_INVALID|ALREADY_APPLIED|EXPIRED)|SOURCE_READ_DEVELOPMENT_(EXPIRED|STEP_TIMEOUT))$/;
  result = { status: 'FAIL', phase, ...outcome, rollbackConfirmed, databaseConnected: connected, failure: typeof e.message === 'string' && allowed.test(e.message) ? e.message : 'FN09_DEVELOPMENT_STEP_FAILED', pgCode: typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : null, sqlPosition: typeof e.position === 'string' && /^\d+$/.test(e.position) ? e.position : null }; process.exitCode = 1;
} finally {
  for (const client of [post, db]) if (client) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([client.end(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('CONNECTION_CLOSE_TIMEOUT')), 5000); })]); }
    catch { result = { ...result, status: 'FAIL', connectionCloseFailure: true, ...disposition(committed, commitAttempted) }; process.exitCode = 1; }
    finally { if (timer) clearTimeout(timer); }
  }
}
console.log(JSON.stringify(result));
