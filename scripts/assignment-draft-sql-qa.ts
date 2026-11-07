import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash, parseWireJson } from '../contracts/canonical.ts';
import { sourceReadMigrationManifest, sourceReadMigrationId } from './source-read-migration.ts';
import { legacyMigrationIds, sourceRootMigrationId } from './source-root-migration.ts';
import { sourceReadPsqlText } from './source-read-psql-batches.ts';

export const assignmentDraftSqlQaResource = Object.freeze({ container: 'anvil-v3-fn09-draft-sql-qa-pg', network: 'anvil-v3-fn09-draft-sql-qa-net', database: 'anvil_v3_fn09_draft_qa', image: 'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425', imageId: 'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f', port: null, hostPublish: false });
export const assignmentDraftMigrationId = '0012_assignment_drafts';
const check = (expression: string, reason: string) => `DO $fn09check$ BEGIN IF (${expression}) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='${reason}'; END IF; END $fn09check$;`;
const settings = "SET LOCAL statement_timeout='10s';SET LOCAL lock_timeout='2s';";
const target = (role: string) => check(`current_database()='anvil_v3_fn09_draft_qa' AND current_user='${role}' AND current_setting('server_version_num')::int BETWEEN 150000 AND 159999 AND current_setting('is_superuser')='off'`, 'FN09_ISOLATED_TARGET_REQUIRED');

/** 새 빈 격리 DB 전용 SQL stdin 준비. 접속/DDL 실행/정식 migration runner 연결은 하지 않는다. */
export async function buildAssignmentDraftSqlQa() {
  const root = await realpath(new URL('..', import.meta.url)), ids = [...legacyMigrationIds, sourceRootMigrationId, sourceReadMigrationId, assignmentDraftMigrationId];
  const previous = await sourceReadMigrationManifest(), expected = new Map(previous.expected); expected.set(sourceReadMigrationId, previous.checksum);
  if (expected.size !== 46 || ids.length !== 47 || new Set(ids).size !== 47) throw Error('QA_FN09_MIGRATION_COUNT_INVALID');
  let schema = 'BEGIN;\n' + settings + '\n' + target('anvil_v3_migrator') + "\nDO $fn09lock$ BEGIN PERFORM pg_advisory_xact_lock(hashtext('anvil-v3-migrations')); END $fn09lock$;\n";
  for (const id of ids) {
    const url = new URL('../db/migrations/' + id + '.sql', import.meta.url); if (await realpath(url) !== join(root, 'db', 'migrations', id + '.sql')) throw Error('QA_FN09_SQL_ROOT_MISMATCH');
    const sql = await readFile(url, 'utf8'), hash = contentHash(Buffer.from(sql)); if (id === assignmentDraftMigrationId) expected.set(id, hash); else if (expected.get(id) !== hash) throw Error('QA_FN09_LEGACY_HASH_MISMATCH');
    schema += sql + '\n;\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES(' + sourceReadPsqlText(id) + ',' + sourceReadPsqlText(hash) + ');\n';
  }
  schema += 'COMMIT;\nSELECT ' + sourceReadPsqlText('{"kind":"FN09_DRAFT_SCHEMA_COMMITTED","migrations":47}') + ';\n';
  const manifest = JSON.stringify(ids.map(id => ({ id, checksum: expected.get(id) })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let readOnly = 'BEGIN READ ONLY;\n' + settings + '\n' + target('anvil_v3_app') + '\n' + check('(SELECT jsonb_agg(jsonb_build_object(\'id\',id,\'checksum\',checksum) ORDER BY id COLLATE "C") FROM anvil.schema_migrations)=' + sourceReadPsqlText(manifest) + '::jsonb', 'FN09_MIGRATION_HASH_MISMATCH') + '\n';
  const vectors = [
    { input: '{"z":false,"a":"한글 😀\\n\\\"\\\\","n":9007199254740991,"x":null}', expected: '{"a":"한글 😀\\n\\\"\\\\","n":9007199254740991,"x":null,"z":false}' },
    { input: '{"b":[{"z":2,"a":1},false,null],"a":[]}', expected: '{"a":[],"b":[{"a":1,"z":2},false,null]}' },
  ];
  for (const v of vectors) readOnly += check('anvil.assignment_draft_canonical(' + sourceReadPsqlText(v.input) + '::jsonb)=' + sourceReadPsqlText(v.expected), 'FN09_CANONICAL_MISMATCH') + '\n';
  for (const name of ['assignment_drafts', 'assignment_draft_versions']) readOnly += check('(SELECT count(*) FROM anvil.' + name + ')=0', 'FN09_NEW_TABLE_NOT_EMPTY') + '\n';
  readOnly += check("has_table_privilege(current_user,'anvil.assignment_drafts','SELECT') AND has_table_privilege(current_user,'anvil.assignment_drafts','INSERT') AND has_table_privilege(current_user,'anvil.assignment_drafts','UPDATE') AND NOT has_table_privilege(current_user,'anvil.assignment_drafts','DELETE') AND has_table_privilege(current_user,'anvil.assignment_draft_versions','SELECT') AND has_table_privilege(current_user,'anvil.assignment_draft_versions','INSERT') AND NOT has_table_privilege(current_user,'anvil.assignment_draft_versions','UPDATE') AND NOT has_table_privilege(current_user,'anvil.assignment_draft_versions','DELETE')", 'FN09_NEW_PRIVILEGE_INVALID') + '\n';
  readOnly += 'COMMIT;\nSELECT ' + sourceReadPsqlText('{"kind":"FN09_DRAFT_READ_ONLY_DONE","migrations":47,"canonicalVectors":2,"newTablesEmpty":2}') + ';\n';
  const deniedWrite = 'BEGIN;\n' + settings + '\n' + target('anvil_v3_app') + `\nDO $fn09deny$ BEGIN
    BEGIN INSERT INTO anvil.assignment_drafts(project_id,id,head_version,created_by,client_id) VALUES('a6f20900-0000-4000-8000-000000000201','a6f20900-0000-4000-8000-000000000301',1,'a6f20900-0000-4000-8000-000000000101','a6f20900-0000-4000-8000-000000000102');
      RAISE EXCEPTION 'FN09_UNAUTHORIZED_INSERT_ACCEPTED' USING ERRCODE='P0001';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END $fn09deny$;\n` + check('(SELECT count(*) FROM anvil.assignment_drafts)=0 AND (SELECT count(*) FROM anvil.assignment_draft_versions)=0', 'FN09_DENIED_WRITE_REMAINS') + '\nROLLBACK;\nSELECT ' + sourceReadPsqlText('{"kind":"FN09_DRAFT_UNAUTHORIZED_WRITE_DENIED","remainingRows":0}') + ';\n';
  return { schema, readOnly, deniedWrite, migrations: 47, previousMigrations: 46, sqlHash: expected.get(assignmentDraftMigrationId)!, actualWorkflowVerified: false, formalDbChanges: 0 };
}
export function assertAssignmentDraftSqlQaBinding(cwd: string, module: string, env: NodeJS.ProcessEnv, now = Date.now()) {
  const deadline = Date.parse(env.ANVIL_FN09_DRAFT_QA_EXPIRES_AT ?? '');
  if (cwd !== '/home/daon/deploy/anvil-v3' || module !== cwd + '/scripts/qa-assignment-draft-sql.ts' || env.ANVIL_FN09_DRAFT_QA_APPROVAL !== 'AV3-FN09-ASSIGNMENT-DRAFT' || !/^[0-9a-f]{40}$/.test(env.ANVIL_FN09_DRAFT_QA_COMMIT ?? '') || !/^[0-9a-f]{64}$/.test(env.ANVIL_FN09_DRAFT_QA_SQL_HASH ?? '') || !Number.isFinite(deadline) || deadline <= now || deadline > now + 7200000 || Object.entries(env).some(([k, v]) => k.startsWith('DOCKER_') && !!v)) throw Error('QA_FN09_RUN_BINDING_INVALID');
  return deadline;
}
export function readAssignmentDraftSqlQaResult(stdout: string, mode: 'SCHEMA' | 'READ_ONLY' | 'DENIED_WRITE') {
  try {
    const lines = stdout.split(/\r?\n/).filter(s => s.trim()); if (lines.length !== 1) throw Error();
    const expected = mode === 'SCHEMA' ? { kind: 'FN09_DRAFT_SCHEMA_COMMITTED', migrations: 47 } : mode === 'READ_ONLY' ? { kind: 'FN09_DRAFT_READ_ONLY_DONE', migrations: 47, canonicalVectors: 2, newTablesEmpty: 2 } : { kind: 'FN09_DRAFT_UNAUTHORIZED_WRITE_DENIED', remainingRows: 0 };
    const value = parseWireJson(lines[0]!); if (JSON.stringify(value) !== JSON.stringify(expected)) throw Error(); return value as typeof expected;
  } catch { throw Error('QA_FN09_RESULT_INVALID'); }
}
