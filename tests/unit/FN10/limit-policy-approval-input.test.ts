import assert from 'node:assert/strict';
import test from 'node:test';
import {readApprovalDetails,assertApprovalCandidate} from '../../../apps/server/modules/approvals/approval-input.ts';
const id='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222';
const ref={id,version:2,contentHash:'b'.repeat(64)};
const details=(operation='revokeLimitPolicy',targetRef:any=ref):any=>({reason:'합성',risks:{data:'합성',security:'합성',cost:'합성',interruption:'합성',unverified:'합성'},rollback:{method:'합성',limitations:'합성',evidenceRefs:[]},expiresAt:'2099-01-01T00:00:00.000Z',candidateCommandId:id,actionScope:{operation,targetRef,expectedVersion:targetRef?.version??0,payloadHash:'a'.repeat(64),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:id,clientId:client},controlGeneration:1}});
const context={actorId:id,clientId:client,controlGeneration:1,allowedOperations:['applyLimitPolicy','revokeLimitPolicy'],now:new Date('2026-10-27T00:00:00Z')};
test('신규 apply만 null0이며 revoke는 반드시 정확 기준 fullref를 요구한다',()=>{
 assert.equal(readApprovalDetails(details('applyLimitPolicy',null),context).actionScope.targetRef,null);
 assert.deepEqual(readApprovalDetails(details(),context).actionScope.targetRef,ref);
 assert.throws(()=>readApprovalDetails(details('revokeLimitPolicy',null),context),/APPROVAL_INPUT_INVALID/);
});
test('연산별 후보 ID·raw payload·top 봉투를 결박하며 다른 연산은 같은 승인으로 소비하지 않는다',()=>{
 const d=details(),c:any={schemaVersion:1,projectId:id,commandId:id,clientId:client,controlGeneration:1,operation:'applyLimitPolicy',targetId:id,expectedVersion:2,baselineRefs:[],approvalRef:null,payload:{policyBaseVersion:2}};
 assert.throws(()=>assertApprovalCandidate(d,c,id,id),/APPROVAL_CANDIDATE_MISMATCH/);
});
