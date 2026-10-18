import assert from 'node:assert/strict';
import { contentHash, canonicalJson } from '../../../contracts/canonical.ts';
import { readBaselineDraftInput } from '../../../apps/server/modules/projects/baseline-input.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
export const baselineId = (n: number) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
export const baselineProjectId = baselineId(1), baselineActor = { actorId: baselineId(2), clientId: baselineId(3), serverOwner: false, credentialGeneration: 1, reauthUntil: null };
export const baselinePolicy = { id: baselineId(4), version: 1, contentHash: 'a'.repeat(64) };
export const baselineAt = new Date('2026-10-18T08:00:00.000Z');
export const baselineInput = (): any => ({ baseRef: null, source: { kind: 'NONE_SELECTED', declarationRef: null, sourceRootRef: null, snapshotRef: null, grantRef: null, unverifiedReason: '실소스 확인 전' }, items: [{ itemId: 'FN01', title: '기준선 기록', designRef: null, featureState: 'PARTIAL', evidenceRefs: [], limitations: '화면/실제 저장 미확인', reason: '후보만 작성됨' }], coverageReason: '전체 합의 기능 검토 전', reason: '초기 후보' });
export const baselineCommand = (operation: string, payload: any, targetId: string | null = null, expectedVersion = 0): any => ({ schemaVersion: 1, projectId: baselineProjectId, commandId: baselineId(20), clientId: baselineActor.clientId, controlGeneration: 1, operation, targetId, expectedVersion, baselineRefs: [], approvalRef: null, payload });
export function baselineStoreFixture() {
 const drafts = new Map<string, any>(), versions = new Map<string, any>(), reviews: any[] = [], adoptions: any[] = [], commands = new Map<string, any>(), receipts = new Map<string, any>(), audit = new Map<string, any>();
 let head: any = null, member: any = { id: baselineProjectId, participation: 'OWNER', archived_at: null }, sourceError: Error | null = null, sourceChanged = false, sourceCalls = 0, baselineMax = 0;
 const key = (id: string, version: number) => id + ':' + version;
 const join = (row: any, draftHead?: number) => {
  const c = commands.get(row.command_id), r = receipts.get(row.command_id), a = audit.get(row.command_id);
  return { ...structuredClone(row), ...(draftHead === undefined ? {} : { head_version: draftHead }), ...structuredClone(c), ...structuredClone(r), ...structuredClone(a) };
 };
 const db: any = { query: async (sql: string, p: any[] = []) => {
  if (sql.startsWith('SELECT transaction_timestamp()')) return { rows: [{ at: baselineAt }] };
  if (sql.includes('FROM anvil.projects p JOIN anvil.project_members')) { assert.equal(p[0], baselineProjectId); assert.equal(p[1], baselineActor.actorId); return { rows: member ? [member] : [] }; }
  if (sql.startsWith('INSERT INTO anvil.commands')) {
   commands.set(p[0], { operation: p[4], command_external_id: p[5], request_hash: p[6], state: 'APPLIED', expected_version: p[10], command_actor: p[2], command_client: p[3], control_generation: p[11], policy_ref: JSON.parse(p[12]), payload_ref: null, approval_consumption_id: null, result_ref: JSON.parse(p[14]), command_scope_kind: 'PROJECT', command_scope_id: p[1] }); return { rows: [] };
  }
  if (sql.startsWith('INSERT INTO anvil.authorization_receipts')) { receipts.set(p[2], { authorization_subject_ref: JSON.parse(p[3]), authorization_policy_ref: JSON.parse(p[4]), receipt_scope_digest: p[5] }); return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.audit_events')) { audit.set(p[4], { server_sequence: audit.size + 1, audit_scope_digest: p[10], audit_outcome: p[8] === 'APPLIED' ? p[8] : 'APPLIED', audit_source_kind: 'HUMAN_COMMAND' }); return { rows: [] }; }
  if (sql.startsWith('SELECT set_config')) return { rows: [] };
  if (sql.startsWith('INSERT INTO anvil.baseline_drafts')) { drafts.set(p[1], { project_id: p[0], id: p[1], head_version: 1, created_by: p[2], client_id: p[3], updated_at: baselineAt }); return { rows: [] }; }
  if (sql.startsWith('UPDATE anvil.baseline_drafts')) { drafts.get(p[1]).head_version = p[2]; return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.baseline_draft_versions')) { const row = { project_id: p[0], draft_id: p[1], version: p[2], content_hash: p[3], version_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7], created_at: baselineAt }; versions.set(key(p[1], p[2]), row); return { rows: [] }; }
  if (sql.startsWith('SELECT head_version FROM anvil.baseline_drafts')) { const row = drafts.get(p[1]); return { rows: row ? [row] : [] }; }
  if (sql.startsWith('SELECT id,') && sql.includes('FROM anvil.baseline_drafts t')) return { rows: [...drafts.values()].map(d => ({ id: d.id, version: d.head_version, content_hash: versions.get(key(d.id, d.head_version)).content_hash, cursor_at: d.updated_at.toISOString(), baseline_kind: null })) };
  if (sql.startsWith('SELECT id,') && sql.includes('FROM anvil.project_baselines t')) return { rows: adoptions.map(b => ({ id: b.id, version: b.version, content_hash: b.content_hash, baseline_kind: b.baseline_kind, cursor_at: b.created_at.toISOString() })) };
  if (sql.includes('FROM anvil.baseline_draft_versions v')) { const row = versions.get(key(p[1], p[2])); return { rows: row ? [join(row, drafts.get(p[1]).head_version)] : [] }; }
  if (sql.startsWith('INSERT INTO anvil.baseline_content_reviews')) { reviews.push({ project_id: p[0], review_id: p[1], draft_id: p[2], draft_version: p[3], draft_hash: p[4], content_hash: p[5], review_json: JSON.parse(p[6]), created_by: p[7], client_id: p[8], command_id: p[9], created_at: baselineAt }); return { rows: [] }; }
  if (sql.includes('FROM anvil.baseline_content_reviews r')) {
   const hits = sql.includes('r.review_id=$2') ? reviews.filter(r => r.review_id === p[1]) : reviews.filter(r => r.draft_id === p[1] && r.draft_version === p[2]);
   return { rows: hits.map(row => join(row)).sort((a, b) => b.server_sequence - a.server_sequence) };
  }
  if (sql.startsWith('SELECT COALESCE(MAX(version)')) return { rows: [{ version: baselineMax }] };
  if (sql.startsWith('INSERT INTO anvil.project_baselines')) { const row = { id: p[0], project_id: p[1], version: p[2], source_snapshot_ref: p[3], content_json: JSON.parse(p[4]), content_hash: p[5], created_by: p[6], baseline_kind: 'FEATURE_STATUS_V1', draft_id: p[7], draft_version: p[8], command_id: p[9], client_id: p[10], source_snapshot_version: p[11], source_snapshot_hash: p[12], created_at: baselineAt }; adoptions.push(row); baselineMax = p[2]; return { rows: [] }; }
  if (sql.startsWith('INSERT INTO anvil.baseline_heads')) { if (head) throw Error('BASELINE_HEAD_INSERT_CONFLICT'); head = { project_id: p[0], baseline_id: p[1], baseline_version: p[2], baseline_hash: p[3] }; return { rows: [] }; }
  if (sql.startsWith('UPDATE anvil.baseline_heads')) { assert(head, '기존 pointer 없이 UPDATE 금지'); head = { project_id: p[0], baseline_id: p[1], baseline_version: p[2], baseline_hash: p[3] }; return { rows: [] }; }
  if (sql.includes('FROM anvil.baseline_heads')) return { rows: head ? [structuredClone(head)] : [] };
  if (sql.includes('FROM anvil.project_baselines b')) {
   const hits = sql.includes('b.draft_id=$2') ? adoptions.filter(b => b.draft_id === p[1] && b.draft_version === p[2]) : adoptions.filter(b => b.id === p[1] && b.version === p[2]);
   return { rows: hits.map(row => row.baseline_kind === 'FEATURE_STATUS_V1' ? join(row) : structuredClone(row)) };
  }
  throw Error('UNEXPECTED_BASELINE_QUERY: ' + sql);
 } };
 const sources: any = { resolve: async (_db: any, actor: any, pid: string, value: any) => {
  assert.equal(actor, baselineActor); assert.equal(pid, baselineProjectId); sourceCalls++;
  if (sourceError) throw sourceError;
  return { ...readBaselineDraftInput(value), sourceBinding: { kind: value.source.kind, declaration: null, observation: null, declarationReportRelation: sourceChanged ? 'CHANGED' : 'UNVERIFIED' }, evidenceBindings: value.items.map((item: any) => ({ itemId: item.itemId, evidenceRefs: structuredClone(item.evidenceRefs) })) };
 } };
 const documents: any = { version: async () => { throw new AuthFailure('NOT_FOUND', 404); }, originalText: async () => { throw new AuthFailure('NOT_FOUND', 404); } };
 return { db, sources, documents, drafts, versions, reviews, adoptions, commands, audit, receipts, member: (value: any) => { member = value; }, sourceError: (error: Error | null) => { sourceError = error; }, sourceChanged: () => { sourceChanged = true; }, sourceCalls: () => sourceCalls, legacyVersion: (n: number) => { baselineMax = n; }, head: () => head, key, hash: (value: any) => contentHash(canonicalJson(value)) };
}
