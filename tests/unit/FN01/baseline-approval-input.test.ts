import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { assertApprovalCandidate, type ApprovalDetails } from '../../../apps/server/modules/approvals/approval-input.ts';
import { baselineActor as actor, baselineProjectId as pid, baselineCommand, baselineInput, baselineId as id } from './baseline-store-fixture.ts';

for (const operation of ['saveBaselineDraft', 'reviewBaselineContent', 'confirmBaseline']) test(operation + ' 승인은 payload와 별도로 정확 기준선 fullhash를 결박한다', () => {
 const target = { id: id(50), version: 1, contentHash: 'a'.repeat(64) };
 const payload: any = operation === 'saveBaselineDraft' ? { ...baselineInput(), baseRef: target } : { draftRef: target, reason: '정확 원명령' };
 const c = baselineCommand(operation, payload, target.id, target.version);
 const details: ApprovalDetails = { candidateCommandId: c.commandId, reason: '별도 승인', risks: { data: '자료', security: '보안', cost: '비용', interruption: '중단', unverified: '실소스 미확인' }, rollback: { method: '후속 기록', limitations: '불변 이력', evidenceRefs: [] }, expiresAt: '2099-01-01T00:00:00.000Z', actionScope: { operation, targetRef: target, expectedVersion: 1, payloadHash: contentHash(canonicalJson(c.payload)), baselineRefs: [], environmentRef: null, sourceScopes: [], limitsRef: null, requestedSubjectRef: { kind: 'HUMAN', userId: actor.actorId, clientId: actor.clientId }, controlGeneration: 1 } };
 assert.doesNotThrow(() => assertApprovalCandidate(details, c, actor.actorId, pid));
 const changed = structuredClone(details); changed.actionScope.targetRef!.contentHash = 'b'.repeat(64);
 // payloadHash도 유효하다. 같은 ID/version만 비교하면 다른 fullhash 승인이 통과한다.
 assert.throws(() => assertApprovalCandidate(changed, c, actor.actorId, pid), /APPROVAL_CANDIDATE_MISMATCH/);
});
