import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
import { ProjectListCodec } from '../../../apps/server/modules/projects/service.ts';
import { contentHash } from '../../../contracts/canonical.ts';
import { baselineActor as actor, baselineProjectId as pid, baselinePolicy as policy, baselineId as id, baselineInput, baselineCommand, baselineStoreFixture } from './baseline-store-fixture.ts';
const module = await import('../../../apps/server/modules/projects/project-baselines.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const fixture = () => { const f = baselineStoreFixture(); assert.equal(typeof (module as any).ProjectBaselines, 'function'); return { ...f, store: new (module as any).ProjectBaselines(f.sources, f.documents) }; };
async function save(f: ReturnType<typeof fixture>) { return f.store.save(f.db, actor, baselineCommand('saveBaselineDraft', baselineInput()), policy); }
const reviewInput = (draftRef: any): any => ({ draftRef, criteriaVersion: 1, reviewerKind: 'HUMAN', items: [{ itemId: 'FN01', featureState: 'PARTIAL', outcome: 'ACCEPTED', reason: '실제 완료 아닌 부분 구현임을 검토', evidenceRefs: [], coreEvidence: null }], coverage: { outcome: 'ACCEPTED', reason: '범위와 미확인을 검토' }, outcome: 'ACCEPTED', reason: '기능 상태 분류 검토' });
async function review(f: ReturnType<typeof fixture>, draftRef: any, input = reviewInput(draftRef), command = id(21)) { const request = baselineCommand('reviewBaselineContent', input, draftRef.id, draftRef.version); request.commandId = command; return f.store.review(f.db, actor, request, policy); }
async function confirm(f: ReturnType<typeof fixture>, draftRef: any, refs: any[], command = id(22)) { const request = baselineCommand('confirmBaseline', { draftRef, reviewRefs: refs, reason: '기능 분류만 별도 채택', acknowledged: true }, draftRef.id, draftRef.version); request.commandId = command; return f.store.confirm(f.db, actor, request, policy); }
test('불변 초안 저장/정확 재조회·CAS 개정은 분리되고 파싱/저장이 내용확정·실행을 만들지 않는다', async () => {
 const f = fixture(), result = await save(f), ref = result.data.ref;
 assert.equal(result.data.status, 'BASELINE_DRAFT_STORED'); assert.equal(result.data.snapshot.contentConfirmed, false); assert.equal(result.data.snapshot.executionAuthorized, false);
 const read = await f.store.readDraft(f.db, actor, pid, ref.id, ref.version); assert.deepEqual(read.ref, ref); assert.equal(read.currentCheck.state, 'MATCHED_METADATA');
 const changed = baselineInput(); changed.baseRef = ref; changed.reason = '두 번째 불변 버전'; const request = baselineCommand('saveBaselineDraft', changed, ref.id, ref.version); request.commandId = id(23);
 const next = await f.store.save(f.db, actor, request, policy); assert.equal(next.data.ref.version, 2); assert.equal(f.versions.size, 2); assert.equal(f.versions.get(f.key(ref.id, 1)).version_json.input.reason, '초기 후보');
 await assert.rejects(f.store.save(f.db, actor, request, policy), /VERSION_CONFLICT/);
});
test('기능 분류 검토·별도 채택과 정확 이력은 최신 review/근거를 다시 대조하며 legacy를 자동 head로 삼지 않는다', async () => {
 const f = fixture(); f.legacyVersion(7); const draft = (await save(f)).data.ref, reviewRef = (await review(f, draft)).data.ref, adopted = await confirm(f, draft, [reviewRef]);
 assert.equal(adopted.data.ref.version, 8); assert.notEqual(adopted.data.ref.id, draft.id); assert.equal(adopted.data.snapshot.previousBaselineRef, null);
 assert.equal(adopted.data.snapshot.contentConfirmed, true); for (const flag of ['sourceAuthorizationVerified', 'coverageVerified', 'executionAuthorized', 'dispatchPerformed']) assert.equal(adopted.data.snapshot[flag], false);
 assert.deepEqual(f.head(), { project_id: pid, baseline_id: adopted.data.ref.id, baseline_version: 8, baseline_hash: adopted.data.ref.contentHash });
 const read = await f.store.read(f.db, actor, pid, adopted.data.ref.id, 8); assert.deepEqual(read.ref, adopted.data.ref); assert.equal(read.currentCheck.state, 'MATCHED_METADATA');
 await assert.rejects(confirm(f, draft, [reviewRef]), /VERSION_CONFLICT/);
});
test('미검토·뒤의 REWORK·다른항목/분류·옛 head는 채택하지 않는다', async () => {
 const f = fixture(), draft = (await save(f)).data.ref; await assert.rejects(confirm(f, draft, []), /BASELINE_CONFIRMATION_INPUT_INVALID/);
 const wrong = reviewInput(draft); wrong.items[0].itemId = 'OTHER'; await assert.rejects(review(f, draft, wrong), /BASELINE_REVIEW_MISMATCH/);
 wrong.items[0].itemId = 'FN01'; wrong.items[0].featureState = 'NOT_IMPLEMENTED'; await assert.rejects(review(f, draft, wrong), /BASELINE_REVIEW_MISMATCH/);
 const accepted = (await review(f, draft)).data.ref, rework = reviewInput(draft); rework.outcome = 'REWORK'; rework.items[0].outcome = 'REWORK'; await review(f, draft, rework, id(24));
 await assert.rejects(confirm(f, draft, [accepted]), /BASELINE_REVIEW_REQUIRED/);
 f.drafts.get(draft.id).head_version = 2; await assert.rejects(review(f, draft), /VERSION_CONFLICT/);
});
test('현재 원문 거절/변경·다른 주체·승인 미연결·변조 receipt를 통과시키지 않는다', async () => {
 const f = fixture(), draft = (await save(f)).data.ref;
 f.sourceError(new AuthFailure('ARTIFACT_QUARANTINED', 412)); const read = await f.store.readDraft(f.db, actor, pid, draft.id, 1); assert.equal(read.currentCheck.state, 'UNAVAILABLE');
 await assert.rejects(review(f, draft), /ARTIFACT_QUARANTINED/); f.sourceError(null); f.sourceChanged();
 assert.equal((await f.store.readDraft(f.db, actor, pid, draft.id, 1)).currentCheck.state, 'CHANGED'); await assert.rejects(review(f, draft), /BASELINE_SOURCE_CHANGED/);
 const approval = baselineCommand('saveBaselineDraft', baselineInput()); approval.approvalRef = { fake: true }; await assert.rejects(f.store.save(f.db, actor, approval, policy), /BASELINE_APPROVAL_NOT_CONNECTED/);
 const row = f.versions.get(f.key(draft.id, 1)); f.commands.get(row.command_id).command_client = id(99); await assert.rejects(f.store.readDraft(f.db, actor, pid, draft.id, 1), /BASELINE_INTEGRITY_FAILED/);
});
test('격리된 옛 근거는 이력으로 보존하고 이를 제거한 새 초안 개정은 막지 않는다', async () => {
 const f = fixture(), old = baselineInput(); old.items[0].evidenceRefs = [{ artifactId: id(30), bytes: 1, contentHash: 'b'.repeat(64), mediaType: 'text/plain;charset=utf-8' }];
 const ref = (await f.store.save(f.db, actor, baselineCommand('saveBaselineDraft', old), policy)).data.ref;
 const resolve = f.sources.resolve; f.sources.resolve = async (...args: any[]) => { if (args[3].items[0].evidenceRefs.length) throw new AuthFailure('ARTIFACT_QUARANTINED', 412); return resolve(...args); };
 const input = baselineInput(); input.baseRef = ref; const request = baselineCommand('saveBaselineDraft', input, ref.id, 1); request.commandId = id(31);
 const updated = await f.store.save(f.db, actor, request, policy); assert.equal(updated.data.ref.version, 2); assert.equal(f.versions.get(f.key(ref.id, 1)).version_json.input.items[0].evidenceRefs.length, 1);
});
test('현재 pointer 없음·명시 채택 조회·뒤 REWORK의 현재 검토 부적합을 과거 채택과 구별한다', async () => {
 const f = fixture(); assert.equal((await f.store.current(f.db, actor, pid)).ref, null);
 const draft = (await save(f)).data.ref, accepted = (await review(f, draft)).data.ref, adopted = await confirm(f, draft, [accepted]);
 assert.deepEqual((await f.store.current(f.db, actor, pid)).ref, adopted.data.ref);
 const wrong = reviewInput(draft); wrong.outcome = 'REWORK'; wrong.items[0].outcome = 'REWORK'; await review(f, draft, wrong, id(32));
 const read = await f.store.read(f.db, actor, pid, adopted.data.ref.id, adopted.data.ref.version);
 assert.equal(read.contentConfirmed, true); assert.equal(read.currentContentReviewValid, false); assert.equal(read.snapshot.reviewRefs[0].id, accepted.id);
 const decision = await f.store.decision(f.db, actor, pid, draft.id, 1); assert.equal(decision.latestReviewAccepted, false); assert.equal(decision.reviews[0].snapshot.input.outcome, 'REWORK');
});
test('목록은 유한 metadata/cursor만 공개하고 legacy 본문을 노출하거나 현재 기준선으로 만들지 않는다', async () => {
 const f = fixture(), draft = (await save(f)).data.ref;
 const codec = new ProjectListCodec(value => contentHash('SYNTHETIC_BASELINE_CURSOR:' + value));
 const listing = await f.store.listDrafts(f.db, actor, pid, { limit: '1' }, codec);
 assert.equal(listing.items.length, 1); assert.deepEqual(listing.items[0].ref, draft); assert.equal(Object.hasOwn(listing.items[0], 'snapshot'), false);
 assert.equal(listing.metadataIntegrity, 'NOT_RECHECKED');
 for (const query of [{ limit: '51' }, { limit: 2 }, { unknown: 'x' }, { cursor: 'broken' }]) await assert.rejects(f.store.listDrafts(f.db, actor, pid, query, codec));
 f.adoptions.push({ id: id(40), project_id: pid, version: 4, content_hash: 'e'.repeat(64), baseline_kind: null, content_json: { hidden: 'DO_NOT_ECHO_LEGACY' }, created_at: new Date('2026-10-18T07:00:00Z') });
 const legacy = await f.store.read(f.db, actor, pid, id(40), 4); assert.equal(legacy.status, 'LEGACY_UNVERIFIED'); assert.equal(legacy.ref, null); assert.equal(legacy.snapshot, null); assert.equal(JSON.stringify(legacy).includes('DO_NOT_ECHO_LEGACY'), false);
 assert.equal((await f.store.current(f.db, actor, pid)).ref, null);
 const history = await f.store.list(f.db, actor, pid, {}, codec); assert.equal(history.items[0].status, 'LEGACY_UNVERIFIED');
});
test('채택 뒤 검토의 추가 근거가 격리되면 과거 기록은 보존하고 현재 근거 가용성을 합격시키지 않는다', async () => {
 const f = fixture(), draft = (await save(f)).data.ref, input = reviewInput(draft);
 input.items[0].evidenceRefs = [{ artifactId: id(45), bytes: 1, contentHash: 'c'.repeat(64), mediaType: 'text/plain;charset=utf-8' }];
 const accepted = (await review(f, draft, input)).data.ref, adopted = await confirm(f, draft, [accepted]);
 const resolve = f.sources.resolve; f.sources.resolve = async (...args: any[]) => { if (args[3].items[0].evidenceRefs.length) throw new AuthFailure('ARTIFACT_QUARANTINED', 412); return resolve(...args); };
 const read = await f.store.read(f.db, actor, pid, adopted.data.ref.id, adopted.data.ref.version);
 assert.equal(read.contentConfirmed, true); assert.equal(read.currentCheck.state, 'UNAVAILABLE'); assert.equal(read.currentContentReviewValid, false);
});
test('두 번째 채택은 잠근 기존 pointer를 UPDATE하고 이전 기준선과 순서를 보존한다', async () => {
 const f = fixture(), firstDraft = (await save(f)).data.ref, firstReview = (await review(f, firstDraft)).data.ref, first = await confirm(f, firstDraft, [firstReview]);
 const input = baselineInput(); input.baseRef = firstDraft; input.items[0].reason = '기능 상태를 새 버전으로 검토';
 const request = baselineCommand('saveBaselineDraft', input, firstDraft.id, firstDraft.version); request.commandId = id(51);
 const secondDraft = (await f.store.save(f.db, actor, request, policy)).data.ref, secondReview = (await review(f, secondDraft, reviewInput(secondDraft), id(52))).data.ref;
 const second = await confirm(f, secondDraft, [secondReview], id(53));
 assert.equal(second.data.ref.version, first.data.ref.version + 1); assert.notEqual(second.data.ref.id, first.data.ref.id); assert.deepEqual(second.data.snapshot.previousBaselineRef, first.data.ref);
 assert.equal(f.head().baseline_id, second.data.ref.id); assert.equal(f.adoptions[0].content_json.previousBaselineRef, null);
});
