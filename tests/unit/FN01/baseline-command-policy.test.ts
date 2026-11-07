import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash, canonicalJson } from '../../../contracts/canonical.ts';
import { ProjectPolicyRepository } from '../../../apps/server/modules/access/project-command.ts';
import { baselineActor as actor, baselineProjectId as pid, baselinePolicy as policy, baselineCommand, baselineInput, baselineId as id } from './baseline-store-fixture.ts';
function fixture() {
 let disposition = 'AUTO', expiresAt = '2099-01-01T00:00:00.000Z', previous: any = null, control: any = { actor_id: actor.actorId, client_id: actor.clientId, generation: 1, revoked_at: null }, calls = 0;
 const request = baselineCommand('saveBaselineDraft', baselineInput());
 const db: any = { query: async (sql: string) => {
  if (sql.includes('FROM anvil.projects p JOIN anvil.project_members')) return { rows: [{ id: pid, archived_at: null, participation: 'OWNER' }] };
  if (sql.includes('FROM anvil.project_control')) return { rows: control ? [control] : [] };
  if (sql.includes('FROM anvil.permission_policies p')) {
   const rules = [{ ruleId: 'BASELINE', subjectRef: { kind: 'HUMAN', userId: actor.actorId }, operations: ['saveBaselineDraft', 'reviewBaselineContent', 'confirmBaseline'], targetScopes: [{ kind: 'PROJECT', projectId: pid }], disposition, limitPolicyRef: null, expiresAt }];
   return { rows: [{ id: policy.id, head_version: 1, rules_json: rules, reason: '합성 명시 정책', review_refs: [], created_at: new Date('2026-10-18T08:00:00.000Z'), content_hash: contentHash(canonicalJson({ rules, reason: '합성 명시 정책', reviewRefs: [] })) }] };
  }
  if (sql.includes('FROM anvil.commands WHERE scope_kind')) return { rows: previous ? [previous] : [] };
  if (sql.startsWith('INSERT INTO anvil.audit_events')) return { rows: [] };
  throw Error('UNEXPECTED_POLICY_QUERY:' + sql);
 } };
 const repository = new ProjectPolicyRepository({ authenticated: async (_token: string, _csrf: string | null, run: any) => run(db, actor) } as any);
 const run = () => repository.command('synthetic', 'synthetic', request, async () => { calls++; return { status: 'CANDIDATE' }; });
 return { request, run, calls: () => calls, disposition: (s: string) => { disposition = s; }, expire: () => { expiresAt = '2000-01-01T00:00:00.000Z'; }, control: (v: any) => { control = v; }, previous: (v: any) => { previous = v; } };
}
test('현재 명시 AUTO만 후보 writer를 호출하고 동일 command replay는 현재 통제 재검사 후 결과를 재사용한다', async () => {
 const f = fixture(); assert.deepEqual(await f.run(), { status: 'CANDIDATE' }); assert.equal(f.calls(), 1);
 f.previous({ operation: f.request.operation, request_hash: contentHash(canonicalJson(f.request)), result_ref: { status: 'STORED_EXACT' } });
 assert.deepEqual(await f.run(), { status: 'STORED_EXACT' }); assert.equal(f.calls(), 1);
 f.request.payload.reason = '다른 payload'; await assert.rejects(f.run(), /IDEMPOTENCY_CONFLICT/); assert.equal(f.calls(), 1);
});
test('REQUIRE_APPROVAL·의미 없는 approvalRef·DENY/만료/다른 client/옛 제어 세대에서 후보 writer 부작용0이다', async () => {
 const required=fixture();required.disposition('REQUIRE_APPROVAL');await assert.rejects(required.run(),{message:'APPROVAL_REQUIRED',statusCode:412});assert.equal(required.calls(),0);
 const extra=fixture();extra.request.approvalRef={fake:true};await assert.rejects(extra.run(),{message:'APPROVAL_NOT_REQUIRED',statusCode:422});assert.equal(extra.calls(),0);
 for (const mutate of [(f: any) => f.disposition('DENY'), (f: any) => f.expire(), (f: any) => { f.request.clientId = id(99); }, (f: any) => f.control({ actor_id: actor.actorId, client_id: actor.clientId, generation: 2, revoked_at: null })]) {
  const f = fixture(); mutate(f); await assert.rejects(f.run()); assert.equal(f.calls(), 0);
 }
});
