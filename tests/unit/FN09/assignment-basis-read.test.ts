import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
const file = new URL('../../../apps/web/src/features/workspace/assignment-basis-read.ts', import.meta.url), module = existsSync(file) ? await import(file.href) : {};
const pid = '10000000-0000-4000-8000-000000000001', aid = '20000000-0000-4000-8000-000000000002';
const plan: any = { documentRef: { id: pid, version: 3, contentHash: 'a'.repeat(64) }, designRef: { id: aid, version: 7, contentHash: 'b'.repeat(64) } };
const body = '사용자가 지식을 소유한다. <script>실행하지 않음</script>', bytes = Buffer.from(body), digest = createHash('sha256').update(bytes).digest('hex');
function fixture(ref: any) { return { id: ref.id, version: ref.version, title: '고정 원문', confirmed: true, contentHash: ref.contentHash,
 formRef: { id: pid, version: 1, contentHash: 'f'.repeat(64) }, content: { body: { artifactId: aid, bytes: bytes.length, contentHash: digest, mediaType: 'text/markdown;charset=utf-8' }, attachments: [], sections: [], sourceRefs: [] }, validation: { validForConfirmation: true, issues: [] }, statusHistory: [], contentReviewCriteria: { criteriaVersion: 1, formRef: { id: pid, version: 1, contentHash: 'f'.repeat(64) }, items: [] }, contentReviews: [] }; }
test('계획·설계 기준 원문은 기존 보호 GET의 정확 버전/hash와 본문을 읽고 입력을 바꾸지 않는다', async () => {
 assert.equal(typeof module.readAssignmentBasisDocument, 'function'); const before = structuredClone(plan);
 for (const [kind, ref] of [['PLAN_DOCUMENT', plan.documentRef], ['DESIGN_DOCUMENT', plan.designRef]] as const) {
  const calls: any[] = [], client = new ApiClient(async (url, options) => { calls.push({ url, method: options?.method }); return calls.length === 1 ? Response.json(fixture(ref)) : new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }); });
  const result = await module.readAssignmentBasisDocument(client, pid, plan, kind);
  assert.equal(result.body, body); assert.deepEqual(result.ref, ref); assert.equal(result.kind, kind);
  assert.deepEqual(calls.map(c => c.url), [`/api/v1/projects/${pid}/documents/${ref.id}/versions/${ref.version}`, `/api/v1/projects/${pid}/files/${aid}`]);
  assert.ok(calls.every(c => c.method === 'GET'));
 }
 assert.deepEqual(plan, before);
});
test('기준 ref hash 불일치·본문 변조는 이전 원문이나 최신 버전으로 대체하지 않는다', async () => {
 assert.equal(typeof module.readAssignmentBasisDocument, 'function');
 const mismatch = new ApiClient(async url => String(url).includes('/documents/') ? Response.json({ ...fixture(plan.designRef), contentHash: 'c'.repeat(64) }) : new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));
 await assert.rejects(module.readAssignmentBasisDocument(mismatch, pid, plan, 'DESIGN_DOCUMENT'), { code: 'ASSIGNMENT_BASIS_CHANGED' });
 const changed = new ApiClient(async url => String(url).includes('/documents/') ? Response.json(fixture(plan.documentRef)) : new Response('변조됨', { headers: { 'Content-Type': 'application/octet-stream' } }));
 await assert.rejects(module.readAssignmentBasisDocument(changed, pid, plan, 'PLAN_DOCUMENT'), { code: 'ARTIFACT_INTEGRITY_FAILED' });
});
test('원문 권한 거절은 그대로 실패하고 잘못된 종류·ref는 전송 전 차단한다', async () => {
 assert.equal(typeof module.readAssignmentBasisDocument, 'function'); let calls = 0;
 const client = new ApiClient(async () => { calls++; return Response.json({ code: 'FORBIDDEN' }, { status: 403 }); });
 await assert.rejects(module.readAssignmentBasisDocument(client, pid, plan, 'PLAN_DOCUMENT'), { status: 403 }); assert.equal(calls, 1);
 for (const [p, kind] of [[plan, 'OTHER'], [{ ...plan, designRef: { ...plan.designRef, contentHash: 'invalid' } }, 'DESIGN_DOCUMENT']] as const) await assert.rejects(module.readAssignmentBasisDocument(client, pid, p, kind), { code: 'ASSIGNMENT_BASIS_INVALID' });
 assert.equal(calls, 1);
});
