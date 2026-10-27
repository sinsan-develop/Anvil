import test from 'node:test';
import assert from 'node:assert/strict';
import { readApprovalDetails, assertApprovalCandidate } from '../../../apps/server/modules/approvals/approval-input.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import {criteriaRef as ref} from '../FN12/result-criteria-fixture.ts';
const id='20000000-0000-4000-8000-000000000002';
function fixture(){
 const payload={stageRef:{applicationRef:ref(1),nodeId:'N1'},methodologyApplicationRef:ref(1),mode:'CASE_BY_CASE',startNodeRef:{applicationRef:ref(1),nodeId:'N1'},endBoundaryRef:{applicationRef:ref(1),nodeId:'N1'},baselineRefs:[ref(2),ref(3)],budgetRef:ref(4),reason:'원 명령'};
 const c:any={schemaVersion:1,projectId:id,commandId:id,clientId:id,controlGeneration:1,operation:'startStage',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
 const details:any={reason:'일회 준비',risks:{data:'자료',security:'보안',cost:'비용',interruption:'중단',unverified:'미확인'},rollback:{method:'보존',limitations:'한계',evidenceRefs:[]},expiresAt:'2099-01-01T00:00:00.000Z',candidateCommandId:id,actionScope:{operation:c.operation,targetRef:null,expectedVersion:0,payloadHash:contentHash(canonicalJson(payload)),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:id,clientId:id},controlGeneration:1}};
 return {c,details,context:{actorId:id,clientId:id,controlGeneration:1,allowedOperations:['startStage'],now:new Date('2026-10-27')}};
}
test('단계 원 payload 기준 순서와 hash는 승인 범위에 그대로 결박한다',()=>{const f=fixture();assert.deepEqual(readApprovalDetails(f.details,f.context),f.details);assert.doesNotThrow(()=>assertApprovalCandidate(f.details,f.c,id,id));f.c.payload.baselineRefs.reverse();assert.throws(()=>assertApprovalCandidate(f.details,f.c,id,id),/APPROVAL_CANDIDATE_MISMATCH/);});
test('정합 재해시한 다른 target scope도 startStage null/0 계약에서 거절한다',()=>{const f=fixture();f.details.actionScope.targetRef=f.c.payload.budgetRef;f.details.actionScope.expectedVersion=1;assert.throws(()=>readApprovalDetails(f.details,f.context),/APPROVAL_INPUT_INVALID/);});
test('다른 명령·client·원 payload·baseline 연결은 승인으로 허용하지 않는다',()=>{for(const change of [(f:any)=>f.c.commandId='30000000-0000-4000-8000-000000000003',(f:any)=>f.c.clientId='30000000-0000-4000-8000-000000000003',(f:any)=>f.c.payload.reason='변경',(f:any)=>f.c.baselineRefs=[f.c.payload.budgetRef]]){const f=fixture();change(f);assert.throws(()=>assertApprovalCandidate(f.details,f.c,id,id),/APPROVAL_CANDIDATE_MISMATCH/);}});
