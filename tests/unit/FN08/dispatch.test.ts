import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as dispatch from '../../../apps/connector/runtime/dispatch.ts';

const id='11111111-1111-4111-8111-111111111111';
const ref={id,version:1,contentHash:'a'.repeat(64)};
function context(){return {projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:{...ref},environmentRef:{...ref},authorizationReceiptRef:{...ref},capabilityRef:{...ref},budgetRef:{...ref},sourceScopes:[{sourceRootRef:{...ref},mappingRef:null,observationRef:{...ref},baselineRef:{...ref},targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]};}
function inspect(value:unknown,expected:unknown){assert.equal(typeof (dispatch as any).inspectDispatchPreconditions,'function');return (dispatch as any).inspectDispatchPreconditions(value,expected);}

test('참조와 snapshot이 맞아도 내부 구조검사일 뿐 실제 실행허가·실행receipt가 아니다',()=>{
 const report=inspect(context(),context());assert.equal(report.structuralChecksPassed,true);assert.equal(report.executionAuthorized,false);assert.equal(report.dispatchPerformed,false);assert.equal(report.kind,'INTERNAL_PRECONDITION_REPORT');
 assert.ok(report.reasons.some((r:any)=>r.code==='SERVER_VERIFIERS_NOT_CONNECTED'));assert.equal(report.reasons.some((r:any)=>r.code==='SOURCE_SCOPE_CONTRACT_UNRESOLVED'),true);
 assert.ok(report.unverifiedChecks.includes('AUTHORIZATION'));assert.ok(report.unverifiedChecks.includes('CURRENT_CONTROL'));assert.ok(report.unverifiedChecks.includes('OWNERSHIP'));assert.ok(report.unverifiedChecks.includes('DURABLE_REPLAY'));
 assert.equal('status' in report,false);assert.equal('receipt' in report,false);assert.equal('operationId' in report,false);
});

test('다른 프로젝트·실행세대·참조의 일치여부만 비교하고 snapshot 자체를 서버 인증으로 취급하지 않는다',()=>{
 for(const [field,value] of [['projectId','22222222-2222-4222-8222-222222222222'],['executionGeneration',2],['connectionRef',{...ref,version:2}],['environmentRef',{...ref,contentHash:'b'.repeat(64)}],['authorizationReceiptRef',{...ref,version:2}],['capabilityRef',{...ref,version:2}],['budgetRef',{...ref,version:2}]]as const){
  const report=inspect({...context(),[field]:value},context());assert.equal(report.structuralChecksPassed,false);assert.equal(report.executionAuthorized,false);assert.ok(report.reasons.some((r:any)=>r.code==='EXPECTED_SNAPSHOT_MISMATCH'&&r.field===field));
 }
 const fake=context();assert.equal(inspect(fake,fake).executionAuthorized,false);
});

test('필수 필드·잘못된 참조/세대와 trusted 성공 위장을 거절한다',()=>{
 const missing=context() as any;delete missing.authorizationReceiptRef;
 for(const value of [null,{},missing,{...context(),trusted:true},{...context(),state:'STARTED'},{...context(),executionGeneration:0},{...context(),executionGeneration:1.5},{...context(),projectId:'../outside'},{...context(),budgetRef:{...ref,contentHash:'invalid'}},{...context(),capabilityRef:{...ref,version:0}}]){
  const report=inspect(value,context());assert.equal(report.structuralChecksPassed,false);assert.equal(report.executionAuthorized,false);assert.equal(report.dispatchPerformed,false);
 }
 assert.equal(inspect(context(),null).structuralChecksPassed,false);assert.equal(inspect(context(),{...context(),trusted:true}).executionAuthorized,false);
});

test('선언된 sourceScopes 문법 외 자료·중복/제어/소유 상태를 추측하거나 실경로/비밀을 결과에 반사하지 않는다',()=>{
 const secret='PRIVATE_TOKEN_NEVER_ECHO',privatePath='D:\\private\\not-authorized';
 const value={...context(),sourceScopes:[{path:privatePath,token:secret,trusted:true}]};const original=structuredClone(value);const report=inspect(value,value);assert.deepEqual(value,original);
 assert.equal(report.structuralChecksPassed,false);assert.ok(report.reasons.some((r:any)=>r.code==='SOURCE_SCOPE_INVALID'&&r.field==='sourceScopes'));assert.equal(report.executionAuthorized,false);assert.ok(report.unverifiedChecks.includes('SOURCE_SCOPE'));assert.ok(report.unverifiedChecks.includes('CAPABILITY'));assert.ok(report.unverifiedChecks.includes('BUDGET'));
 const output=JSON.stringify(report);assert.equal(output.includes(secret),false);assert.equal(output.includes(privatePath),false);assert.equal(output.includes('PREPARED'),false);assert.equal(output.includes('STARTED'),false);assert.equal(output.includes('RECLAIMED'),false);
 let called=false;const getter={...context()};Object.defineProperty(getter,'authorizationReceiptRef',{enumerable:true,get(){called=true;throw Error(secret);}});
 const denied=inspect(getter,context());assert.equal(called,false);assert.equal(denied.structuralChecksPassed,false);assert.equal(JSON.stringify(denied).includes(secret),false);
});

test('빈 범위·탈출경로·recursive·대소문자 중복은 실제/예상 snapshot 양쪽에서 문법 거절한다',()=>{
 const scope=context().sourceScopes[0]!;
 for(const sourceScopes of [[],null,[{...scope,targets:[{...scope.targets[0],relativePath:'../outside'}]}],[{...scope,targets:[{...scope.targets[0],recursive:true}]}],[{...scope,targets:[scope.targets[0],{...scope.targets[0],relativePath:'SRC/A.TS'}]}],[scope,scope]]){
  const report=inspect({...context(),sourceScopes},context());assert.equal(report.structuralChecksPassed,false);assert.ok(report.reasons.some((r:any)=>r.code==='SOURCE_SCOPE_INVALID'&&r.field==='sourceScopes'));
  const expected=inspect(context(),{...context(),sourceScopes});assert.equal(expected.structuralChecksPassed,false);assert.ok(expected.reasons.some((r:any)=>r.code==='EXPECTED_SOURCE_SCOPE_INVALID'&&r.field==='sourceScopes'));assert.equal(expected.executionAuthorized,false);
 }
});
test('두 유효 snapshot의 범위·권한·고정 관측 참조 차이는 불일치이며 원입력을 보존한다',()=>{
 for(const mutate of [(v:any)=>v.sourceScopes[0].targets[0].access='WRITE',(v:any)=>v.sourceScopes[0].observationRef.version=2,(v:any)=>v.sourceScopes[0].targets[0].relativePath='src/b.ts']){
  const expected=context(),value=context();mutate(value);const before=structuredClone(value),report=inspect(value,expected);assert.equal(report.structuralChecksPassed,false);assert.ok(report.reasons.some((r:any)=>r.code==='EXPECTED_SNAPSHOT_MISMATCH'&&r.field==='sourceScopes'));assert.deepEqual(value,before);assert.equal(report.executionAuthorized,false);assert.equal(report.dispatchPerformed,false);
 }
});
