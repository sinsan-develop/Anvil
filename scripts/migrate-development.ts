import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { validateDevelopmentDbConfig } from '../apps/server/storage/development-config.ts';
import { buildOfficialForms } from '../apps/server/modules/documents/forms.ts';
import { seedOfficialForms } from '../apps/server/modules/documents/catalog-seed.ts';
import { buildBuiltinMethodologies } from '../apps/server/modules/methodologies/builtins.ts';
import { seedBuiltinMethodologies } from '../apps/server/modules/methodologies/catalog-seed.ts';

const configFile = process.env.ANVIL_DB_CONFIG;
if (!configFile) throw Error('PROTECTED_DB_CONFIG_REQUIRED');
const config = validateDevelopmentDbConfig(JSON.parse(await readFile(configFile, 'utf8')), 'migrator');
const client = new Client(config);
const sql = await readFile(new URL('../db/migrations/0000_environment.sql', import.meta.url), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const receipts = [{ migration: '0000_environment', checksum }];
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
  // 명시한 의존 순서만 실행한다. 파일 이름 정렬이나 임의 SQL 경로를 받지 않는다.
for (const id of ['0001_projects_access', '0011_authorization', '0003_documents', '0002_methodologies', '0002_builtin_condition_contract', '0011_user_common_control', '0011_user_common_forms', '0011_user_common_content_reviews', '0011_user_common_method_reviews', '0011_project_creation', '0011_draft_method_reviews', '0011_project_policy_control', '0003_project_artifacts', '0003_project_documents', '0003_project_document_reviews', '0003_document_confirmations', '0003_document_imports', '0003_document_proposals', '0004_design_index', '0004_work_plan_drafts', '0004_trace_links', '0005_knowledge_drafts', '0005_conversations', '0005_knowledge_changes', '0005_knowledge_confirmation', '0005_artifact_quarantine', '0004_work_plan_confirmation', '0004_design_change_proposals', '0004_design_impact_reviews', '0004_design_impact_review_operator_fix', '0004_design_change_sources', '0004_design_change_source_binding_fix', '0011_one_time_approval_requests']) {
    const content = await readFile(new URL('../db/migrations/' + id + '.sql', import.meta.url), 'utf8');
    const expected = createHash('sha256').update(content).digest('hex');
    const row = await client.query('SELECT checksum FROM anvil.schema_migrations WHERE id=$1', [id]);
    if (row.rowCount) {
      if (row.rows[0].checksum !== expected) throw Error('MIGRATION_CHECKSUM_CONFLICT');
    } else {
      await client.query(content);
      await client.query('INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)', [id, expected]);
    }
    receipts.push({ migration: id, checksum: expected });
  }
  const catalog = buildOfficialForms(await readFile(new URL('../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../docs/design/문서작성_공통기준.md', import.meta.url)));
  await seedOfficialForms(client, catalog);
  await seedBuiltinMethodologies(client, buildBuiltinMethodologies(await readFile(new URL('../docs/design/기본방법론_상세검토안.md', import.meta.url)), catalog.forms), catalog.forms);
  const fixtures = JSON.parse(await readFile(new URL('../db/qa/fixtures.json', import.meta.url), 'utf8'));
  for (const [name, value] of Object.entries(fixtures)) {
    await client.query('INSERT INTO anvil_qa.fixtures(name,payload) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET payload=EXCLUDED.payload', [name, JSON.stringify(value)]);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ migrations: receipts, fixtures: Object.keys(fixtures).length, realProductUsersCreated: 0, status: 'applied-and-seeded' }));
} catch {
  await client.query('ROLLBACK').catch(() => {});
  console.error('DEVELOPMENT_MIGRATION_FAILED_NO_SECRET_OUTPUT');
  process.exitCode = 1;
} finally { await client.end(); }
