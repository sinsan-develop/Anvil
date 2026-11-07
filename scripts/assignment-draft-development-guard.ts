import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash } from '../contracts/canonical.ts';
import { sourceReadMigrationManifest, sourceReadMigrationId } from './source-read-migration.ts';
import { assignmentDraftMigrationId } from './assignment-draft-sql-qa.ts';
import type { SourceReadTableState, SourceReadDevelopmentBinding } from './source-read-development-guard.ts';
export const assignmentDevelopmentTables = Object.freeze(['assignment_drafts', 'assignment_draft_versions']);
// 승인된 기존46 SQL CREATE TABLE 목록과 2026-10-18 정식 READ ONLY 81표가 일치한 고정 집합이다.
export const assignmentDevelopmentBaselineNames = Object.freeze([
  ...['approval_consumptions','approval_decisions','approval_requests','artifacts','audit_events','auth_actions','auth_attempt_windows','auth_audit_events','auth_sessions','authoring_standard_versions','authorization_receipts','clients','commands','connection_candidate_versions','connection_candidates','connector_credentials','connector_registration_challenges','connector_registrations','connectors','constitution_applications','content_reviews','conversation_messages','conversations','delivery_outbox','design_change_impacts','design_changes','design_items','document_artifact_links','document_confirmations','document_import_selections','document_imports','document_proposal_selections','document_proposals','document_version_events','document_versions','documents','draft_audit_events','draft_methodology_reviews','form_definitions','form_reviews','form_versions','installation_claims','knowledge_entries','knowledge_events','knowledge_versions','methodology_definitions','methodology_reviews','methodology_versions','password_credentials','permission_policies','permission_policy_versions','plan_dependencies','plan_tasks','project_baselines','project_constitutions','project_control','project_drafts','project_events','project_members','project_methodologies','project_source_declarations','projects','recovery_credentials','schema_migrations','screen_regions','source_declaration_versions','source_declarations','source_read_challenges','source_read_credentials','source_read_grants','source_root_versions','source_roots','source_snapshots','trace_edges','user_common_audit_events','user_invitations','users','work_plan_confirmations','work_plan_versions','work_plans'].map(name => 'anvil.' + name), 'anvil_qa.fixtures',
]);
export function assertAssignmentDevelopmentBefore(before: SourceReadTableState[]) {
  const names = before.map(row => row.schema + '.' + row.name).sort();
  if (names.length !== 81 || names.join(',') !== assignmentDevelopmentBaselineNames.join(',') || before.find(r => r.schema === 'anvil' && r.name === 'schema_migrations')?.n !== '46') throw Error('FN09_DEVELOPMENT_BASELINE_INVALID');
}
export function readAssignmentDevelopmentBinding(input: SourceReadDevelopmentBinding, now: number) {
  const expiresAtMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(now) || input.platform !== 'linux' || input.uid !== 1000 || input.cwd !== '/home/daon/deploy/anvil-v3' || input.origin !== 'git@github-sinsan-develop:sinsan-develop/Anvil.git' || input.dirty !== '' || input.configPath !== '/home/daon/.local/share/anvil-v3-development/migrator.json' || input.approval !== 'AV3-FN09-FORMAL-SCHEMA-ONLY' || !/^[0-9a-f]{40}$/.test(input.commit) || input.head !== input.commit || !/^[0-9a-f]{64}$/.test(input.sqlHash) || !Number.isFinite(expiresAtMs) || expiresAtMs <= now || expiresAtMs > now + 7200000) throw Error('FN09_DEVELOPMENT_BINDING_INVALID');
  return { commit: input.commit, sqlHash: input.sqlHash, expiresAtMs };
}
export async function assignmentDevelopmentManifest() {
  const old = await sourceReadMigrationManifest(), expected = new Map(old.expected); expected.set(sourceReadMigrationId, old.checksum);
  const root = await realpath(new URL('..', import.meta.url)), file = new URL('../db/migrations/' + assignmentDraftMigrationId + '.sql', import.meta.url);
  if (await realpath(file) !== join(root, 'db', 'migrations', assignmentDraftMigrationId + '.sql')) throw Error('FN09_DEVELOPMENT_ROOT_INVALID');
  const sql = await readFile(file, 'utf8'); return { expected, sql, checksum: contentHash(Buffer.from(sql)) };
}
export function assertAssignmentDevelopmentManifest(rows: { id: string; checksum: string }[], manifest: { expected: Map<string, string>; checksum: string }, phase: 'BEFORE' | 'AFTER') {
  const target = new Map(manifest.expected); if (phase === 'AFTER') target.set(assignmentDraftMigrationId, manifest.checksum);
  if (!['BEFORE', 'AFTER'].includes(phase) || manifest.expected.size !== 46 || manifest.expected.has(assignmentDraftMigrationId) || !manifest.expected.has(sourceReadMigrationId) || !/^[0-9a-f]{64}$/.test(manifest.checksum) || rows.length !== target.size || new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => target.get(r.id) !== r.checksum)) throw Error('FN09_DEVELOPMENT_MANIFEST_INVALID');
}
export function assertAssignmentDevelopmentBaseline(before: SourceReadTableState[], after: SourceReadTableState[]) {
  assertAssignmentDevelopmentBefore(before);
  const fail = (): never => { throw Error('FN09_DEVELOPMENT_BASELINE_INVALID'); }, key = (r: SourceReadTableState) => r.schema + '.' + r.name;
  for (const list of [before, after]) { if (new Set(list.map(key)).size !== list.length) fail(); for (const r of list) if (!['anvil', 'anvil_qa'].includes(r.schema) || !/^[a-z0-9_]+$/.test(r.name) || !/^\d+$/.test(r.n) || !/^[0-9a-f]{32}$/.test(r.fingerprint) || !/^[0-9a-f]{64}$/.test(r.structureHash)) fail(); }
  const old = new Map(before.map(r => [key(r), r])), current = new Map(after.map(r => [key(r), r]));
  if (old.get('anvil.schema_migrations')?.n !== '46' || after.length !== before.length + 2) fail();
  for (const name of assignmentDevelopmentTables) if (old.has('anvil.' + name) || current.get('anvil.' + name)?.n !== '0') fail();
  for (const [id, previous] of old) { const value = current.get(id); if (!value || value.structureHash !== previous.structureHash || value.fingerprint !== previous.fingerprint) fail(); if (id === 'anvil.schema_migrations') { if (value!.n !== '47') fail(); } else if (value!.n !== previous.n) fail(); }
}
