import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {providerClaimFixture} from './provider-claim-fixture.ts';
import {readServerExecutionFactV1} from '../../../contracts/runtime/server-execution-fact-v1.ts';
const m:any=await import('../../integration/FN06/provider-claim-data-case-qa.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('실DB 원자성 시험도 합성 source/OS 전제를 명시해야 하며 실제 Provider/current 승격을 거절한다',()=>{const v={transport:'SYNTHETIC_ONLY',sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE',actualProviderObserved:false};m.validateClaimDataQaPremise(v);for(const bad of[{}, {...v,transport:'REAL'},{...v,sourceOsMode:'VERIFIED_CURRENT_OS'},{...v,actualProviderObserved:true},{...v,currentFactsVerified:true}])assert.throws(()=>m.validateClaimDataQaPremise(bad));});

test('합성 facts도 같은 실제 writer 행·범위와 DB 시각을 읽으며 원 binding은 변경하지 않는다',async()=>{
 const premise={transport:'SYNTHETIC_ONLY',sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE',actualProviderObserved:false};
 const scope={mode:'EXECUTION',projectId:randomUUID(),connectorId:randomUUID(),executionId:randomUUID(),executionGeneration:1,grantRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},credentialGeneration:1};
 const binding={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:1,transport:'SYNTHETIC_ONLY',writerState:'NONE',intent:{sourceScopes:[{sourceRootRef:{id:randomUUID(),version:1,contentHash:'b'.repeat(64)}}]},checkedAt:'2026-10-22T00:00:00.000Z'};
 const before=structuredClone(binding),calls:any[]=[];
 const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return calls.length===1?{rows:[{scope_json:binding.intent.sourceScopes}]}:{rows:[{at:new Date('2026-10-22T00:00:01.000Z')}]};}};
 const facts=m.createClaimDataQaFacts(premise),out=await facts.current(db,scope,binding);
 assert.deepEqual(calls[0].args,[scope.projectId,scope.executionId,1,scope.grantRef.id,1]);
 assert.match(calls[0].sql,/ownership_state='SYNTHETIC_CLAIM'/);assert.match(calls[0].sql,/reclaimed_at IS NULL/);assert.match(calls[0].sql,/expires_at>clock_timestamp\(\)/);
 assert.equal(calls.length,2);assert.equal(out.writerState,'OWNED');assert.equal(out.checkedAt,'2026-10-22T00:00:01.000Z');assert.deepEqual(binding,before);
 out.intent.sourceScopes.length=0;assert.equal(binding.intent.sourceScopes.length,1);
});

test('writer 부재·중복·범위차이·조회실패는 합성 current 양성으로 대체하지 않는다',async()=>{
 const premise={transport:'SYNTHETIC_ONLY',sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE',actualProviderObserved:false};
 const scope={mode:'EXECUTION',projectId:randomUUID(),connectorId:randomUUID(),executionId:randomUUID(),executionGeneration:1,grantRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},credentialGeneration:1};
 const binding={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:1,transport:'SYNTHETIC_ONLY',intent:{sourceScopes:[]}};
 const facts=m.createClaimDataQaFacts(premise);
 for(const rows of[[],[{scope_json:[]} ,{scope_json:[]}],[{scope_json:[{different:true}]}]]){
  let calls=0;await assert.rejects(facts.current({query:async()=>{calls++;return{rows};}},scope,binding));assert.equal(calls,1);
 }
 await assert.rejects(facts.current({query:async()=>{throw Error('PRIVATE_FAULT');}},scope,binding));
 let calls=0;await assert.rejects(facts.current({query:async()=>{calls++;return{rows:[]};}},scope,{...binding,projectId:randomUUID()}));assert.equal(calls,0);
});

test('전체 caller는 합성 전제 누락 또는 폐기형 실행환경 밖에서 DB·API를 시작하지 않는다',async()=>{
 let touched=0;const input={premise:{transport:'SYNTHETIC_ONLY',sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE',actualProviderObserved:false},pool:{query:async()=>{touched++;throw Error('UNEXPECTED_DB');}},app:{inject:async()=>{touched++;throw Error('UNEXPECTED_API');}}};
 await assert.rejects(()=>m.runProviderClaimDataCase({...input,premise:{}}),/CLAIM_DATA_QA_SYNTHETIC_PREMISE_REQUIRED/);
 await assert.rejects(()=>m.runProviderClaimDataCase(input),/CLAIM_DATA_QA_TARGET_REQUIRED/);assert.equal(touched,0);
});

test('새 QA current fact는 서로 다른 확정임무·준비 두 근거 모두 원 validator에 결박한다',()=>{
 const base=structuredClone(providerClaimFixture().basis.fact),assignment={id:randomUUID(),version:1,contentHash:'d'.repeat(64)},preparation={id:randomUUID(),version:1,contentHash:'e'.repeat(64)};
 base.osEvidenceRefs=base.checks.osFence.evidenceRefs;delete base.checks;base.agentSession.sessionRef={id:randomUUID(),version:1,contentHash:'f'.repeat(64)};base.intent.assignmentRef=assignment;base.preparationRef=preparation;base.basisRefs=[assignment,preparation];
 const fact=m.buildClaimDataQaCurrentFact(base),checked=readServerExecutionFactV1(fact);
 assert.deepEqual(checked.checks.basis.evidenceRefs,[assignment,preparation]);assert.deepEqual(checked.basisRefs,[assignment,preparation]);assert.equal(base.checks,undefined);
 const missing=structuredClone(fact);missing.checks.basis.evidenceRefs=[preparation];assert.throws(()=>readServerExecutionFactV1(missing),/SERVER_EXECUTION_FACT_INVALID/);
});
