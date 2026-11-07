import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareResultRework} from '../../../apps/server/modules/results/result-rework-input.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
import {reworkFixture} from './result-rework-input-fixture.ts';
import {criteriaId as id,criteriaRef as ref} from './result-criteria-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const module:any=await import('../../../apps/server/modules/results/rework-origin-material.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const f=reworkFixture(),p=prepareResultRework(f.sources,f.input,f.now);
 const storedSnapshot={scope:p.scope,input:f.input,criteriaRef:p.criteriaRef,roleRef:p.roleRef,stageSessionRef:p.stageSessionRef,remainingMissingItems:['denied'],preservedItems:[],requestedBy:{kind:'HUMAN',userId:id(6),clientId:id(24)},requestedAt:f.now,scopeVerification:'ASSIGNMENT_SUBSET_ONLY_NOT_OS_VERIFIED',completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false};
 const rework:any={projectId:f.sources.assignment.projectId,ref:{id:id(60),version:1,contentHash:hash(storedSnapshot)},status:'RESULT_REWORK_DRAFT_STORED',snapshot:storedSnapshot,reworkStored:true,currentBindingVerified:false,currentAuthorityVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:f.now};
 const definition=structuredClone(f.sources.assignment.snapshot.definition);definition.acceptanceCriteria=['실제 저장'];definition.verificationRequirements=[];definition.allowedScopes=structuredClone(f.input.sourceScopes);
 const input={sourceReworkRef:structuredClone(rework.ref),definition,reason:'선택 저장조건 보완'};
 const basis={planRef:definition.taskRef.planRef,applicationRef:definition.taskRef.applicationRef,designRef:definition.baselineRefs[0],taskCode:definition.taskRef.taskCode,nodeId:definition.taskRef.nodeId,taskCardHash:'b'.repeat(64)};
 const snapshot:any={definition,reason:input.reason,previousRef:null,basis,readinessIssues:readAssignmentDraftInput({baseRef:null,definition,reason:input.reason}).readinessIssues,status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draft:any={ref:{id:id(61),version:1,contentHash:hash(snapshot)},snapshot};
 const context:any={originId:id(62),userId:id(6),clientId:id(24),transactionAt:f.now};
 return{...f,rework,input,draft,context,rehash:()=>draft.ref.contentHash=hash(snapshot)};
}
function build(f:ReturnType<typeof fixture>){assert.equal(typeof module.prepareReworkOriginMaterial,'function','불변 origin material 결박 미구현');return module.prepareReworkOriginMaterial(f.sources,f.rework,f.input,f.draft,f.context,f.now);}

test('고정 신규 초안 ref에서만 origin hash를 계산하고 원본 역참조·실제 저장 주장을 만들지 않는다',()=>{
 const f=fixture(),before=canonicalJson([f.sources,f.rework,f.input,f.draft,f.context]),v=build(f),s=v.originSnapshot;
 assert.equal(v.status,'REWORK_ORIGIN_MATERIAL_NOT_STORED');assert.equal(v.storageVerified,false);assert.equal(v.currentAuthorityVerified,false);
 assert.equal(s.kind,'REWORK_ASSIGNMENT_ORIGIN_V1');assert.equal(s.projectId,f.rework.projectId);
 assert.deepEqual(s.successorDraftRef,f.draft.ref);assert.deepEqual(s.sourceReworkRef,f.rework.ref);
 assert.deepEqual(s.sourceAssignmentRef,f.sources.assignment.ref);assert.deepEqual(s.selectedCriteriaIds,['save']);assert.deepEqual(s.remainingCriteriaIds,['denied']);assert.deepEqual(s.preservedCriteriaIds,[]);
 assert.deepEqual(s.requestedBy,{userId:id(6),clientId:id(24)});assert.equal(s.requestedAt,f.now);assert.equal(s.definitionHash,hash(f.input.definition));
 assert.equal(v.originRef.id,id(62));assert.equal(v.originRef.version,1);assert.equal(v.originRef.contentHash,hash(s));
 assert.equal(s.linkageStored,true);for(const key of ['contentConfirmed','currentReservationVerified','executionAuthorized','dispatchPerformed','completionAccepted','formalFailureCounted'])assert.equal(s[key],false);
 assert.equal('originRef' in f.draft.snapshot,false);assert.equal('authorizationReceiptRef' in s,false);assert.equal('commandId' in s,false);
 assert.equal(canonicalJson([f.sources,f.rework,f.input,f.draft,f.context]),before);s.requestedBy.userId=id(99);assert.equal(f.context.userId,id(6));
});

test('다른 초안 hash·개정/부모/역참조·다른 정의·basis·준비상태/권위 위조는 재해시해도 거절한다',()=>{
 for(const change of [
  (f:any)=>f.draft.ref.contentHash='0'.repeat(64),
  (f:any)=>f.draft.ref.version=2,
  (f:any)=>f.draft.ref.id=f.sources.assignment.ref.id,
  (f:any)=>{f.draft.snapshot.previousRef=ref(70);f.rehash();},
  (f:any)=>{f.draft.snapshot.originRef=ref(71);f.rehash();},
  (f:any)=>{f.draft.snapshot.definition=structuredClone(f.draft.snapshot.definition);f.draft.snapshot.definition.goal='다른 초안';f.rehash();},
  (f:any)=>{f.draft.snapshot.basis.nodeId='다른 단계';f.rehash();},
  (f:any)=>{f.draft.snapshot.basis.designRef=ref(72);f.rehash();},
  (f:any)=>{f.draft.snapshot.readinessIssues=[];f.rehash();},
  (f:any)=>{f.draft.snapshot.ready=true;f.rehash();},
  (f:any)=>{f.draft.snapshot.executionAuthorized=true;f.rehash();},
 ]){const f=fixture();change(f);assert.throws(()=>build(f),/REWORK_ORIGIN_/);}
});

test('caller 영수증/추가 권위·잘못된 주체/시각을 origin hash에 주입할 수 없다',()=>{
 for(const change of [
  (f:any)=>f.context.authorizationReceiptRef=ref(80),
  (f:any)=>f.context.userId='invalid',
  (f:any)=>f.context.clientId='invalid',
  (f:any)=>f.context.originId='invalid',
  (f:any)=>f.context.transactionAt='2099-01-01T00:00:00.000Z',
  (f:any)=>f.now='invalid',
 ]){const f=fixture();change(f);assert.throws(()=>build(f),/REWORK_ORIGIN_/);}
});
