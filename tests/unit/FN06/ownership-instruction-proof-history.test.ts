import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-instruction-proof-history.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(){
 const x=await providerTurnFixture(),permit=structuredClone(x.permit),scope=permit.snapshot.scope,events=structuredClone(x.f.state().challenges);
 const consumed=events.find((e:any)=>e.snapshot.consumption&&e.snapshot.consumption.resultRef.id===permit.snapshot.proofRef.id),original=events.find((e:any)=>e.ref.id===consumed.ref.id&&e.ref.version===1);
 const snapshot:any={kind:'SYNTHETIC_PROOF_RESULT',challengeRef:structuredClone(original.ref),requestId:original.snapshot.request.requestId,proofHash:consumed.snapshot.consumption.proofHash,recordedAt:consumed.snapshot.consumption.consumedAt,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
 const ref={id:permit.snapshot.proofRef.id,version:1,contentHash:hash(snapshot)};consumed.snapshot.consumption.resultRef=ref;consumed.ref.contentHash=hash(consumed.snapshot);permit.snapshot.proofRef=ref;permit.ref.contentHash=hash(permit.snapshot);
 const row:any={project_id:scope.projectId,id:ref.id,version:1,grant_id:scope.grantRef.id,grant_version:scope.grantRef.version,challenge_id:original.ref.id,challenge_version:1,content_hash:ref.contentHash,snapshot_json:snapshot};
 const rows=()=>events.map((e:any)=>({project_id:scope.projectId,id:e.ref.id,version:e.ref.version,grant_id:scope.grantRef.id,grant_version:scope.grantRef.version,server_sequence:e.snapshot.sequence,content_hash:e.ref.contentHash,snapshot_json:e.snapshot}));
 const queries:string[]=[];const db={async query(sql:string,args:any[]=[]){queries.push(sql);if(sql.includes('FROM anvil.execution_receipts')){assert.deepEqual(args,[scope.projectId,ref.id,1]);return{rows:[row]};}if(sql.includes('FROM anvil.execution_challenges')){assert.deepEqual(args,[scope.projectId,scope.grantRef.id,scope.grantRef.version]);return{rows:rows()};}throw Error('UNEXPECTED_QUERY');},release(){throw Error('CALLER_OWNS_CONNECTION');}} as unknown as PoolClient;
 const read=()=>{assert.equal(typeof m.readOwnershipInstructionProofHistory,'function','원 proof 영수증과 consumed challenge 연결이 필요하다');return m.readOwnershipInstructionProofHistory(db,permit,scope,'2026-10-22T02:00:00.010Z');};
 const reseal=()=>{original.snapshot.requestHash=hash(original.snapshot.request);original.ref.contentHash=hash(original.snapshot);consumed.snapshot.request=structuredClone(original.snapshot.request);consumed.snapshot.requestHash=original.snapshot.requestHash;consumed.snapshot.previousRef=structuredClone(original.ref);snapshot.challengeRef=structuredClone(original.ref);row.content_hash=hash(snapshot);permit.snapshot.proofRef.contentHash=row.content_hash;if(consumed.snapshot.consumption)consumed.snapshot.consumption.resultRef=structuredClone(permit.snapshot.proofRef);consumed.ref.contentHash=hash(consumed.snapshot);const p=permit.snapshot,{checkedAt:_,expires:__,...fact}=p.currentFact;p.bindingHash=hash({scope:p.scope,commandRef:p.commandRef,authorizationReceiptRef:p.authorizationReceiptRef,reservationRef:p.reservationRef,fact});permit.ref.contentHash=hash(p);};
 return{x,permit,scope,events,original,consumed,snapshot,row,read,queries,reseal};
}
test('원 영수증 hash·challenge 원문과 이미 소비된 정확 SEND target을 읽기 결박한다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.purpose,'OWNERSHIP_INSTRUCTION_PROOF_HISTORY_ONLY');assert.deepEqual(r.proofRef,f.permit.snapshot.proofRef);assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);assert.equal(r.currentAuthorityVerified,false);assert.equal(r.signatureVerified,false);assert(f.queries.every(q=>q.startsWith('SELECT ')));
});
test('영수증/행/소비원문/target 불일치를 저장 CONSUMED 표식으로 덮지 않는다',async()=>{
 for(const change of [(f:any)=>f.row.challenge_id=f.scope.executionId,(f:any)=>f.snapshot.credentialIssued=true,(f:any)=>f.snapshot.proofHash='0'.repeat(64),(f:any)=>f.consumed.snapshot.consumption=null,(f:any)=>f.original.snapshot.request.target.bodyHash='0'.repeat(64),(f:any)=>f.row.grant_version=2]){const f=await fixture();change(f);await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_PROOF_HISTORY_UNAVAILABLE/);}
});
test('선택한 permit의 hash가 바뀌거나 proof가 다른 요청으로 교체되면 거절한다',async()=>{
 const f=await fixture();f.permit.snapshot.proofRef.id=f.scope.executionId;await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_PROOF_HISTORY_UNAVAILABLE/);assert.equal(f.queries.length,0);
});
test('정합 재해시한 다른 실행 credential 세대의 permit에 원 scope proof를 붙이지 않는다',async()=>{
 const f=await fixture();f.permit.snapshot.scope={...f.scope,credentialGeneration:2};f.reseal();await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_PROOF_HISTORY_UNAVAILABLE/);assert.equal(f.queries.length,0);
});
test('정합 재해시한 원 target·receipt proofHash·소비상태 불일치도 거절한다',async()=>{
 for(const change of [(f:any)=>f.original.snapshot.request.target.bodyHash='0'.repeat(64),(f:any)=>f.snapshot.proofHash='0'.repeat(64),(f:any)=>f.consumed.snapshot.consumption=null]){const f=await fixture();change(f);f.reseal();await assert.rejects(f.read(),/OWNERSHIP_INSTRUCTION_PROOF_HISTORY_UNAVAILABLE/);}
});
