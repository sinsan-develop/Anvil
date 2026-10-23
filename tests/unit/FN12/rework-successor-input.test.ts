import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
import {reworkFixture} from './result-rework-input-fixture.ts';
import {criteriaId as id} from './result-criteria-fixture.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v));
const module:any=await import('../../../apps/server/modules/results/rework-successor-input.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const f=reworkFixture(),p=prepareResultRework(f.sources,f.input,f.now),at=f.now;
 const snapshot={scope:p.scope,input:structuredClone(f.input),criteriaRef:p.criteriaRef,roleRef:p.roleRef,stageSessionRef:p.stageSessionRef,remainingMissingItems:['denied'],preservedItems:[],requestedBy:{kind:'HUMAN',userId:id(6),clientId:id(24)},requestedAt:at,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
 const stored:any={projectId:f.sources.assignment.projectId,ref:{id:id(60),version:1,contentHash:hash(snapshot)},status:'RESULT_REWORK_DRAFT_STORED',snapshot,reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:at};
 const definition=structuredClone(f.sources.assignment.snapshot.definition);
 definition.purpose='원 저장 조건 보완';definition.goal='저장 확인의 누락 보완';definition.acceptanceCriteria=['실제 저장'];definition.verificationRequirements=[];definition.allowedScopes=structuredClone(f.input.sourceScopes);
 const input:any={sourceReworkRef:structuredClone(stored.ref),definition,reason:'선택한 저장 조건만 보완'};
 return{...f,stored,input,rehash:()=>{stored.ref.contentHash=hash(snapshot);input.sourceReworkRef=structuredClone(stored.ref);}};
}
function prepare(f:ReturnType<typeof fixture>){assert.equal(typeof module.prepareReworkSuccessorDefinition,'function','보완 후속 조건 관계 검사 미구현');return module.prepareReworkSuccessorDefinition(f.sources,f.stored,f.input,f.now);}

test('선택한 원조건만 도출하고 잔여 미달을 보존하며 저장·합격·실행으로 승격하지 않는다',()=>{
 const f=fixture(),before=canonicalJson([f.sources,f.stored,f.input]),v=prepare(f);
 assert.deepEqual(v.definition.acceptanceCriteria,['실제 저장']);assert.deepEqual(v.definition.verificationRequirements,[]);
 assert.deepEqual(v.selectedCriteriaIds,['save']);assert.deepEqual(v.remainingCriteriaIds,['denied']);assert.deepEqual(v.preservedCriteriaIds,[]);
 assert.deepEqual(v.sourceReworkRef,f.stored.ref);assert.deepEqual(v.sourceResultRef,f.sources.result.ref);assert.deepEqual(v.sourceReviewRef,f.sources.review.ref);assert.deepEqual(v.sourceCriteriaRef,f.sources.criteria.ref);
 assert.deepEqual(v.stageSessionRef,f.sources.binding.snapshot.sessionRef);assert.deepEqual(v.connectionRef,f.sources.binding.snapshot.connectionRef);
 assert.equal(v.definitionHash,hash(f.input.definition));
 for(const key of ['linkageStored','contentConfirmed','currentReservationVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])assert.equal(v[key],false,key);
 assert.equal(canonicalJson([f.sources,f.stored,f.input]),before);v.definition.purpose='변경';assert.equal(f.input.definition.purpose,'원 저장 조건 보완');
});

test('같은 ID의 다른 hash·다른 프로젝트·원문 변조·재해시한 잔여/합격 추론을 거절한다',()=>{
 for(const alter of [
  (f:any)=>f.input.sourceReworkRef.contentHash='0'.repeat(64),
  (f:any)=>f.stored.projectId=id(99),
  (f:any)=>f.stored.snapshot.input.reason='변조',
  (f:any)=>{f.stored.snapshot.remainingMissingItems=[];f.rehash();},
  (f:any)=>{f.stored.snapshot.preservedItems=['denied'];f.rehash();},
  (f:any)=>{f.stored.snapshot.criteriaRef.contentHash='0'.repeat(64);f.rehash();},
  (f:any)=>{f.sources.binding.snapshot.connectionRef.id=id(99);},
  (f:any)=>{f.stored.currentAuthorityVerified=true;},
 ]){const f=fixture();alter(f);assert.throws(()=>prepare(f),/REWORK_SUCCESSOR_/);}
});

test('두 미달 조건을 명시 선택하면 두 종류 원문을 도출하되 합격 조건은 만들지 않는다',()=>{
 const f=fixture();f.stored.snapshot.input.missingItems=['save','denied'];f.stored.snapshot.remainingMissingItems=[];
 f.input.definition.verificationRequirements=['중요 거절'];f.rehash();const v=prepare(f);
 assert.deepEqual(v.selectedCriteriaIds,['save','denied']);assert.deepEqual(v.remainingCriteriaIds,[]);
 assert.deepEqual(v.definition.acceptanceCriteria,['실제 저장']);assert.deepEqual(v.definition.verificationRequirements,['중요 거절']);
 assert.deepEqual(v.preservedCriteriaIds,[]);assert.equal(v.completionAccepted,false);assert.equal(v.linkageStored,false);
});

test('transaction 시작시각을 저장 완료시각으로 오인해 잠금 대기 중 생성된 정상 원문을 거절하지 않는다',()=>{
 for(const change of [
  (f:any)=>{f.sources.review.snapshot.reviewedAt='2026-10-20T00:00:45.000Z';f.sources.review.ref.contentHash=hash(f.sources.review.snapshot);f.stored.snapshot.input.reviewRef=structuredClone(f.sources.review.ref);},
  (f:any)=>{f.sources.binding.snapshot.boundAt='2026-10-20T00:00:45.000Z';f.sources.binding.ref.contentHash=hash(f.sources.binding.snapshot);f.stored.snapshot.input.responsibleBindingRef=structuredClone(f.sources.binding.ref);},
  (f:any)=>{f.sources.criteria.registeredAt='2026-10-20T00:00:45.000Z';},
 ]){const f=fixture();f.stored.snapshot.requestedAt='2026-10-20T00:00:30.000Z';change(f);f.rehash();const v=prepare(f);assert.deepEqual(v.sourceReworkRef,f.stored.ref);assert.equal(v.linkageStored,false);assert.equal(v.currentReservationVerified,false);}
});

test('선택 밖 조건·파일/기준/환경·예산·능력 확대와 child 전환을 거절한다',()=>{
 for(const alter of [
  (f:any)=>f.input.definition.verificationRequirements=['중요 거절'],
  (f:any)=>f.input.definition.acceptanceCriteria=['다른 조건'],
  (f:any)=>f.input.definition.allowedScopes[0].targets[0].access='WRITE',
  (f:any)=>f.input.definition.allowedScopes[0].targets[0].relativePath='src/other.ts',
  (f:any)=>f.input.definition.allowedScopes[0].observationRef.contentHash='0'.repeat(64),
  (f:any)=>f.input.definition.environmentRef.version++,
  (f:any)=>f.input.definition.baselineRefs.pop(),
  (f:any)=>f.input.definition.budgetRef={id:id(90),version:1,contentHash:'a'.repeat(64)},
  (f:any)=>f.input.definition.requiredCapabilities.push('추가 실행'),
  (f:any)=>f.input.definition.taskRef.nodeId='other',
  (f:any)=>f.input.definition.parentAssignmentRef=f.sources.assignment.ref,
 ]){const f=fixture();alter(f);assert.throws(()=>prepare(f),/REWORK_SUCCESSOR_/);}
});

test('입력 추가필드·빈이유·비밀·시각/크기 오류와 저장 전 원문을 거절한다',()=>{
 for(const alter of [
  (f:any)=>f.input.originRef=f.stored.ref,
  (f:any)=>f.input.reason=' ',
  (f:any)=>f.input.reason='-----BEGIN PRIVATE KEY-----',
  (f:any)=>f.stored.observedAt='2099-01-01T00:00:00.000Z',
  (f:any)=>{f.stored.snapshot.requestedAt='2099-01-01T00:00:00.000Z';f.rehash();},
  (f:any)=>f.now='invalid',
  (f:any)=>f.input.reason='가'.repeat(800000),
  (f:any)=>f.stored.reworkStored=false,
 ]){const f=fixture();alter(f);assert.throws(()=>prepare(f),/REWORK_SUCCESSOR_/);}
});
